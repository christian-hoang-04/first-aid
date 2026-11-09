from __future__ import annotations

import io
import math
import os
import threading
import time
from functools import lru_cache
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from scipy.signal import resample_poly


APP_DIR = Path(__file__).resolve().parent
MODEL_CACHE = Path(
    os.environ.get("LOCALAPPDATA", str(Path.home()))
) / "first-aid-asr-demo" / "models"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
# Cohere Transcribe 03-2026 accepts audio up to 400 seconds.
MAX_AUDIO_SECONDS = 400

MODELS = {
    "qwen3": {
        "repo_id": "handy-computer/Qwen3-ASR-1.7B-gguf",
        "filename": "Qwen3-ASR-1.7B-Q8_0.gguf",
        "revision": "0e0a596e3959c3f3f2ab7d443a5b6f0f4a4bba6f",
        "folder": "qwen3-asr-1.7b",
    },
    "cohere": {
        "repo_id": "handy-computer/cohere-transcribe-03-2026-gguf",
        "filename": "cohere-transcribe-03-2026-Q8_0.gguf",
        "revision": "7353b6040bdc1be9e5a3823d99d5fe12afe88264",
        "folder": "cohere-transcribe-03-2026",
    },
    "funasr": {
        "repo_id": "handy-computer/Fun-ASR-MLT-Nano-2512-gguf",
        "filename": "Fun-ASR-MLT-Nano-2512-Q8_0.gguf",
        "revision": "08f28dadd984030331802b2f9fbd9ecac97bf834",
        "folder": "fun-asr-mlt-nano-2512",
    },
}
ALLOWED_MODELS = set(MODELS)

app = FastAPI(title="Vietnamese ASR demo")
inference_lock = threading.Lock()


@app.get("/", response_class=FileResponse)
def home() -> FileResponse:
    return FileResponse(APP_DIR / "index.html")


def _cpu_device():
    import transcribe_cpp

    for device in transcribe_cpp.backends():
        if device.device_type == "cpu":
            return device
    raise RuntimeError("The transcribe.cpp CPU backend is not available.")


def _model_path(model_id: str) -> Path:
    from huggingface_hub import hf_hub_download

    spec = MODELS[model_id]
    model_dir = MODEL_CACHE / spec["folder"]
    model_dir.mkdir(parents=True, exist_ok=True)
    return Path(
        hf_hub_download(
            repo_id=spec["repo_id"],
            filename=spec["filename"],
            revision=spec["revision"],
            local_dir=str(model_dir),
            token=False,
        )
    )


@lru_cache(maxsize=3)
def _load_model(model_id: str):
    import transcribe_cpp

    return transcribe_cpp.Model(_model_path(model_id), device=_cpu_device())


def _resample(audio: np.ndarray, source_rate: int, target_rate: int = 16000) -> np.ndarray:
    if source_rate == target_rate:
        return np.ascontiguousarray(audio, dtype=np.float32)
    divisor = math.gcd(source_rate, target_rate)
    converted = resample_poly(
        audio, target_rate // divisor, source_rate // divisor
    )
    return np.ascontiguousarray(converted, dtype=np.float32)


def _transcribe(model_id: str, audio: np.ndarray, sample_rate: int) -> tuple[str, float]:
    model = _load_model(model_id)
    audio_16k = _resample(audio, sample_rate)
    started = time.perf_counter()
    with model.session() as session:
        result = session.run(audio_16k, language="vi")
    elapsed = time.perf_counter() - started
    return result.text.strip(), elapsed


@app.post("/api/transcribe")
def transcribe_audio(
    file: UploadFile = File(...), models: list[str] = Form(...)
) -> dict[str, object]:
    payload = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File size must be 50 MB or less.")
    if not models or any(model not in ALLOWED_MODELS for model in models):
        raise HTTPException(status_code=400, detail="Choose one or more listed models.")

    try:
        audio, sample_rate = sf.read(
            io.BytesIO(payload), dtype="float32", always_2d=True
        )
    except Exception as error:
        raise HTTPException(
            status_code=415,
            detail="Could not read this audio. Use a WAV, FLAC, or OGG file.",
        ) from error

    if sample_rate <= 0 or audio.shape[0] == 0:
        raise HTTPException(status_code=400, detail="The audio file is empty.")
    duration = audio.shape[0] / sample_rate
    if duration > MAX_AUDIO_SECONDS:
        raise HTTPException(
            status_code=413, detail="Audio must be 6 minutes 40 seconds or shorter."
        )

    mono_audio = np.mean(audio, axis=1, dtype=np.float32)
    if not np.all(np.isfinite(mono_audio)):
        raise HTTPException(status_code=400, detail="The audio contains invalid values.")

    results = []
    with inference_lock:
        for model_id in dict.fromkeys(models):
            try:
                transcript, elapsed = _transcribe(model_id, mono_audio, sample_rate)
                results.append(
                    {
                        "model": model_id,
                        "text": transcript,
                        "seconds": elapsed,
                        "realtime_factor": duration / elapsed if elapsed > 0 else None,
                    }
                )
            except Exception as error:
                results.append(
                    {"model": model_id, "error": str(error) or error.__class__.__name__}
                )

    return {"duration": duration, "results": results}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=7860, log_level="info")
