import io
import math
import os
import re
import struct
import threading
import time
import unicodedata
import wave
from functools import lru_cache
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from scipy.signal import resample_poly

app = FastAPI(title="Esmarch Voice Classification", version="0.2.0")
app.add_middleware(CORSMiddleware,
                   allow_origins=[value.strip() for value in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if value.strip()],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

SCENARIOS = {
    "cardiac": ["bất tỉnh", "không thở", "ngừng tim", "ngã quỵ"],
    "choking": ["hóc", "nghẹn", "dị vật", "không nói được", "không ho được"],
    "stroke": ["méo miệng", "yếu tay", "nói khó", "đột quỵ", "tai biến"],
    "bleeding": ["chảy máu", "mất máu", "đứt tay", "vết thương", "tai nạn"],
}
EN_SCENARIOS = {
    "cardiac": ["unresponsive", "not breathing", "cardiac arrest", "collapsed"],
    "choking": ["choking", "cannot cough", "cannot speak"],
    "stroke": ["stroke", "face drooping", "arm weakness", "slurred speech"],
    "bleeding": ["bleeding", "blood loss", "deep cut"],
}

class TriageRequest(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    locale: Literal["vi", "en"] = "vi"

class TriageResponse(BaseModel):
    scenario_id: str | None
    confidence: float
    matched_terms: list[str]
    emergency_call_recommended: bool = True
    disclaimer: str = "Kết quả hỗ trợ nhận diện, không phải chẩn đoán y khoa."
    engine: str = "KEYWORD_RULES"
    requires_confirmation: bool = True

def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.lower()).replace("đ", "d")
    unaccented = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", unaccented)).strip()

def contains_phrase(text: str, phrase: str) -> bool:
    return f" {normalize(phrase)} " in f" {normalize(text)} "

def classify(text: str, locale: str = "vi") -> TriageResponse:
    terms_by_scenario = SCENARIOS if locale == "vi" else EN_SCENARIOS
    scores = {key: [term for term in terms if contains_phrase(text, term)] for key, terms in terms_by_scenario.items()}
    maximum = max(map(len, scores.values()))
    winners = [key for key, terms in scores.items() if len(terms) == maximum]
    negated = any(contains_phrase(text, phrase) for phrase in ["không bị", "không có", "not choking", "no stroke", "not bleeding"])
    if maximum == 0 or len(winners) != 1 or negated:
        return TriageResponse(scenario_id=None, confidence=0, matched_terms=[])
    scenario_id = winners[0]
    matches = scores[scenario_id]
    confidence = min(0.97, 0.72 + 0.1 * len(matches))
    return TriageResponse(scenario_id=scenario_id, confidence=confidence, matched_terms=matches)

@app.get("/health")
def health(): return {"status": "ok", "service": "sos-now-ai", "engine": "KEYWORD_RULES"}

@app.post("/triage", response_model=TriageResponse)
def triage(request: TriageRequest): return classify(request.text, request.locale)


ASR_MODEL_ID = "Fun-ASR-MLT-Nano-2512"
ASR_REPO_ID = "handy-computer/Fun-ASR-MLT-Nano-2512-gguf"
ASR_FILENAME = "Fun-ASR-MLT-Nano-2512-Q8_0.gguf"
ASR_REVISION = "08f28dadd984030331802b2f9fbd9ecac97bf834"
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_AUDIO_SECONDS = 60
ASR_LOCK = threading.Lock()
ASR_MODEL_DIR = Path(os.environ.get(
    "ASR_MODEL_CACHE",
    str(Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache")) / "sos-now" / "models" / "fun-asr-mlt-nano-2512"),
))


@lru_cache(maxsize=1)
def load_asr_model():
    import transcribe_cpp
    from huggingface_hub import hf_hub_download

    ASR_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = hf_hub_download(
        repo_id=ASR_REPO_ID,
        filename=ASR_FILENAME,
        revision=ASR_REVISION,
        local_dir=str(ASR_MODEL_DIR),
        token=False,
    )
    cpu = next((device for device in transcribe_cpp.backends() if device.device_type == "cpu"), None)
    if cpu is None:
        raise RuntimeError("The transcribe.cpp CPU backend is unavailable.")
    return transcribe_cpp.Model(model_path, device=cpu)


def decode_wav(payload: bytes) -> tuple[np.ndarray, int]:
    try:
        with wave.open(io.BytesIO(payload), "rb") as audio_file:
            channels = audio_file.getnchannels()
            sample_width = audio_file.getsampwidth()
            sample_rate = audio_file.getframerate()
            frames = audio_file.getnframes()
            if audio_file.getcomptype() != "NONE" or sample_width != 2 or channels not in (1, 2):
                raise HTTPException(status_code=415, detail="Use uncompressed mono or stereo 16-bit WAV audio.")
            if not 8000 <= sample_rate <= 192000:
                raise HTTPException(status_code=400, detail="Sample rate must be between 8 and 192 kHz.")
            if frames <= 0:
                raise HTTPException(status_code=400, detail="The audio file is empty.")
            if frames / sample_rate > MAX_AUDIO_SECONDS:
                raise HTTPException(status_code=413, detail="Audio must be 60 seconds or shorter.")
            raw_pcm = audio_file.readframes(frames)
            if len(raw_pcm) != frames * channels * sample_width:
                raise HTTPException(status_code=400, detail="The WAV file is incomplete.")
            pcm = np.frombuffer(raw_pcm, dtype="<i2").astype(np.float32) / 32768.0
    except (wave.Error, EOFError, struct.error) as error:
        raise HTTPException(status_code=415, detail="Could not read the audio. Upload a 16-bit WAV file.") from error

    if channels == 2:
        pcm = pcm.reshape(-1, 2).mean(axis=1, dtype=np.float32)
    return np.ascontiguousarray(pcm), sample_rate


@app.post("/transcribe")
def transcribe(file: UploadFile = File(...)):
    payload = file.file.read(MAX_AUDIO_BYTES + 1)
    if len(payload) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio must be 10 MB or smaller.")
    audio, sample_rate = decode_wav(payload)
    divisor = math.gcd(sample_rate, 16000)
    if sample_rate != 16000:
        audio = resample_poly(audio, 16000 // divisor, sample_rate // divisor)
    audio = np.ascontiguousarray(audio, dtype=np.float32)

    with ASR_LOCK:
        model = load_asr_model()
        started = time.perf_counter()
        with model.session() as session:
            result = session.run(audio, language="vi")
        seconds = time.perf_counter() - started
    return {"text": result.text.strip(), "model": ASR_MODEL_ID, "seconds": seconds}
