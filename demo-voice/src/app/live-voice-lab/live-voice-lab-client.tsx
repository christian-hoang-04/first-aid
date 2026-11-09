"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./live-voice-lab.css";

type Voice = { id: string; name?: string; description?: string; featured?: number | null };
type ServiceStatus = {
  asr: { online: boolean; model: string; streaming: boolean };
  tts: { online: boolean; model: string; backend: string | null; voices: Voice[] };
};
type Capture = {
  stream: MediaStream;
  context: AudioContext;
  processor: ScriptProcessorNode;
  mute: GainNode;
  samples: Float32Array[];
  startedAt: number;
  sampleRate: number;
};
type Run = {
  id: number;
  transcript: string;
  audioSeconds: number | null;
  asrModelMs: number | null;
  asrRoundTripMs: number;
  ttsFirstByteMs: number | null;
  ttsTotalMs: number | null;
};

const MAX_RECORD_SECONDS = 30;
const fallbackStatus: ServiceStatus = {
  asr: { online: false, model: "Fun-ASR-MLT-Nano-2512", streaming: false },
  tts: { online: false, model: "vieneu-v3-turbo", backend: null, voices: [] },
};

function formatMs(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}

function makeWav(samples: Float32Array[], sourceRate: number) {
  const sourceLength = samples.reduce((length, part) => length + part.length, 0);
  const source = new Float32Array(sourceLength);
  let writeAt = 0;
  for (const part of samples) {
    source.set(part, writeAt);
    writeAt += part.length;
  }

  const sampleRate = 16000;
  const outputLength = Math.max(1, Math.floor((source.length * sampleRate) / sourceRate));
  const dataLength = outputLength * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);

  for (let index = 0; index < outputLength; index += 1) {
    const position = (index * sourceRate) / sampleRate;
    const before = Math.min(Math.floor(position), source.length - 1);
    const after = Math.min(before + 1, source.length - 1);
    const fraction = position - before;
    const value = source[before] * (1 - fraction) + source[after] * fraction;
    const clipped = Math.max(-1, Math.min(1, value));
    view.setInt16(44 + index * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function responseError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export default function LiveVoiceLabClient() {
  const [services, setServices] = useState(fallbackStatus);
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribing">("idle");
  const [checking, setChecking] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [replyText, setReplyText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [asrRoundTripMs, setAsrRoundTripMs] = useState<number | null>(null);
  const [asrModelMs, setAsrModelMs] = useState<number | null>(null);
  const [ttsFirstByteMs, setTtsFirstByteMs] = useState<number | null>(null);
  const [ttsTotalMs, setTtsTotalMs] = useState<number | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const captureRef = useRef<Capture | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const response = await fetch("/api/voice-lab/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not read local service status.");
      const next = (await response.json()) as ServiceStatus;
      setServices(next);
      setSelectedVoice((current) => current || next.tts.voices[0]?.id || "");
    } catch (cause) {
      setServices(fallbackStatus);
      setError(cause instanceof Error ? cause.message : "Could not read service status.");
    } finally {
      setChecking(false);
    }
  }, []);

  const refreshServices = useCallback(() => {
    setChecking(true);
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    const statusCheck = window.setTimeout(() => void loadServices(), 0);
    return () => {
      window.clearTimeout(statusCheck);
      const capture = captureRef.current;
      captureRef.current = null;
      if (capture) {
        capture.processor.disconnect();
        capture.mute.disconnect();
        capture.stream.getTracks().forEach((track) => track.stop());
        void capture.context.close();
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [loadServices]);

  const speak = useCallback(async (text: string, run?: Omit<Run, "ttsFirstByteMs" | "ttsTotalMs">) => {
    if (!text.trim()) {
      setError("Type a short Vietnamese line to speak.");
      return;
    }
    setError("");
    setNotice("Sending text to local VieNeu TTS…");
    setSpeaking(true);
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/voice-lab/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: selectedVoice || undefined }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      const firstByteHeader = Number(response.headers.get("x-voice-lab-first-byte-ms"));
      const firstByte = Number.isFinite(firstByteHeader)
        ? firstByteHeader
        : performance.now() - startedAt;
      const audio = await response.blob();
      const total = performance.now() - startedAt;
      setTtsFirstByteMs(firstByte);
      setTtsTotalMs(total);
      setNotice(`Audio ready · ${Math.max(1, Math.round(audio.size / 1024))} KB`);

      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(audio);
      audioUrlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        try {
          await audioRef.current.play();
        } catch {
          setNotice("Audio ready · press play below if playback did not start.");
        }
      }

      if (run) {
        setRuns((current) => [
          { ...run, ttsFirstByteMs: firstByte, ttsTotalMs: total },
          ...current,
        ].slice(0, 8));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Local speech synthesis failed.");
      setNotice("");
    } finally {
      setSpeaking(false);
    }
  }, [selectedVoice]);

  const transcribe = useCallback(async (wav: Blob, recordedSeconds: number) => {
    setPhase("transcribing");
    setError("");
    setNotice("Waiting for the final local transcript…");
    const form = new FormData();
    form.append("file", new File([wav], "voice-lab.wav", { type: "audio/wav" }));
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/voice-lab/asr", { method: "POST", body: form });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as {
        text: string;
        audioSeconds: number | null;
        modelMs: number | null;
      };
      const requestMs = performance.now() - startedAt;
      const heard = payload.text.trim();
      setTranscript(heard);
      setAsrRoundTripMs(requestMs);
      setAsrModelMs(payload.modelMs);

      if (!heard) {
        setReplyText("");
        setNotice("No words detected. Try a little closer to the microphone.");
        return;
      }

      const reply = `Mình nghe bạn nói: ${heard}`;
      setReplyText(reply);
      setNotice("Transcript ready · speaking a fixed echo, no LLM involved.");
      await speak(reply, {
        id: Date.now(),
        transcript: heard,
        audioSeconds: payload.audioSeconds ?? recordedSeconds,
        asrModelMs: payload.modelMs,
        asrRoundTripMs: requestMs,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Local transcription failed.");
      setNotice("");
    } finally {
      setPhase("idle");
    }
  }, [speak]);

  const stopRecording = useCallback(async () => {
    const capture = captureRef.current;
    if (!capture) return;
    captureRef.current = null;
    const recordedSeconds = (performance.now() - capture.startedAt) / 1000;
    capture.processor.onaudioprocess = null;
    capture.processor.disconnect();
    capture.mute.disconnect();
    capture.stream.getTracks().forEach((track) => track.stop());
    await capture.context.close();
    setElapsed(recordedSeconds);

    if (recordedSeconds < 0.35 || capture.samples.length === 0) {
      setPhase("idle");
      setNotice("");
      setError("Recording was too short. Hold the mic for at least a moment, then try again.");
      return;
    }
    await transcribe(makeWav(capture.samples, capture.sampleRate), recordedSeconds);
  }, [transcribe]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => {
      const capture = captureRef.current;
      if (!capture) return;
      const seconds = (performance.now() - capture.startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_RECORD_SECONDS) void stopRecording();
    }, 120);
    return () => window.clearInterval(timer);
  }, [phase, stopRecording]);

  const startRecording = async () => {
    setError("");
    setNotice("");
    setTranscript("");
    setReplyText("");
    setAsrRoundTripMs(null);
    setAsrModelMs(null);
    setTtsFirstByteMs(null);
    setTtsTotalMs(null);

    if (!services.asr.online) {
      setError("Local FunASR is offline. Start the local ASR service, then refresh status.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      const samples: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      captureRef.current = {
        stream,
        context,
        processor,
        mute,
        samples,
        startedAt: performance.now(),
        sampleRate: context.sampleRate,
      };
      setElapsed(0);
      setPhase("recording");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microphone permission was not available.");
    }
  };

  const ready = services.asr.online && services.tts.online;
  const voiceOptions = services.tts.voices;
  const sortedRuns = runs;

  return (
    <main className="liveVoiceLab-page" lang="vi">
      <header className="liveVoiceLab-header">
        <Link className="liveVoiceLab-brand" href="/voice-test" aria-label="Back to Voice Lab">
          <span className="liveVoiceLab-brandMark">S</span>
          <span>SOS NOW <small>/ LOCAL VOICE LAB</small></span>
        </Link>
        <div className="liveVoiceLab-headerRight">
          <span className={`liveVoiceLab-localBadge ${ready ? "is-ready" : ""}`}>
            <i /> {ready ? "LOCAL SERVICES READY" : checking ? "CHECKING LOCAL SERVICES" : "SERVICE OFFLINE"}
          </span>
          <Link className="liveVoiceLab-backLink" href="/voice-test">Existing Voice Lab ↗</Link>
        </div>
      </header>

      <section className="liveVoiceLab-intro">
        <div>
          <p className="liveVoiceLab-eyebrow">EXPERIMENT 01 <span>·</span> VIETNAMESE AUDIO</p>
          <h1>Local voice,<br /><em>measured live.</em></h1>
          <p className="liveVoiceLab-lede">
            Speak a short phrase. This page runs local FunASR, shows its final transcript,
            then reads a fixed echo with local VieNeu TTS.
          </p>
        </div>
        <aside className="liveVoiceLab-introNote">
          <span className="liveVoiceLab-noteIndex">01 / CURRENT BASELINE</span>
          <strong>Turn-based component test</strong>
          <p>Not full duplex. No LLM, cloud API, or first-aid advice in this demo.</p>
        </aside>
      </section>

      <section className="liveVoiceLab-grid" aria-label="Local voice experiment">
        <article className="liveVoiceLab-workbench">
          <div className="liveVoiceLab-cardHeader">
            <div>
              <span className="liveVoiceLab-eyebrow">LIVE TEST BENCH</span>
              <h2>Try one turn</h2>
            </div>
            <button className="liveVoiceLab-refresh" type="button" onClick={() => void refreshServices()} disabled={checking}>
              {checking ? "Checking…" : "↻ Refresh status"}
            </button>
          </div>

          <div className="liveVoiceLab-pipeline" aria-label="Audio flow">
            <span><b>01</b> MICROPHONE</span><i />
            <span><b>02</b> FUNASR</span><i />
            <span><b>03</b> SCRIPTED ECHO</span><i />
            <span><b>04</b> VIENEU</span>
          </div>

          <div className={`liveVoiceLab-recorder ${phase === "recording" ? "is-recording" : ""}`}>
            <div className="liveVoiceLab-recorderOrb"><span /></div>
            <div className="liveVoiceLab-recorderCopy">
              <strong>{phase === "recording" ? "Listening to this turn" : phase === "transcribing" ? "Getting the final transcript" : "Ready when you are"}</strong>
              <span>{phase === "recording" ? "Press stop when you finish speaking" : "Microphone starts only after you press the button"}</span>
            </div>
            <time>{phase === "recording" ? `${elapsed.toFixed(1)}s` : "30s max"}</time>
          </div>

          <button
            type="button"
            className={`liveVoiceLab-recordButton ${phase === "recording" ? "is-stop" : ""}`}
            onClick={() => phase === "recording" ? void stopRecording() : void startRecording()}
            disabled={phase === "transcribing" || (checking && !services.asr.online)}
          >
            <span>{phase === "recording" ? "■" : "●"}</span>
            {phase === "recording" ? "Stop & transcribe" : phase === "transcribing" ? "Transcribing locally…" : "Start microphone"}
          </button>
          <p className="liveVoiceLab-privacy">Audio goes to the local service on this machine at 127.0.0.1:7860.</p>

          <div className="liveVoiceLab-divider"><span>YOUR TRANSCRIPT</span><i /></div>
          <div className="liveVoiceLab-transcript" aria-live="polite">
            {transcript || <span className="liveVoiceLab-placeholder">Your final Vietnamese transcript appears here.</span>}
          </div>
          <label className="liveVoiceLab-replyLabel" htmlFor="liveVoiceLab-reply">
            FIXED ECHO · EDIT TO TEST TTS
          </label>
          <textarea
            id="liveVoiceLab-reply"
            className="liveVoiceLab-reply"
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="After transcription: Mình nghe bạn nói: …"
            maxLength={3000}
            rows={3}
          />
          <div className="liveVoiceLab-outputControls">
            <label className="liveVoiceLab-voiceSelectLabel" htmlFor="liveVoiceLab-voice">TTS voice</label>
            <select
              id="liveVoiceLab-voice"
              className="liveVoiceLab-voiceSelect"
              value={selectedVoice}
              onChange={(event) => setSelectedVoice(event.target.value)}
              disabled={!voiceOptions.length}
            >
              {voiceOptions.length ? voiceOptions.map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.name || voice.id}</option>
              )) : <option value="">Service default</option>}
            </select>
            <button className="liveVoiceLab-speakButton" type="button" onClick={() => void speak(replyText)} disabled={speaking || !services.tts.online || !replyText.trim()}>
              {speaking ? "Generating…" : "▶ Speak text"}
            </button>
          </div>
          <audio className="liveVoiceLab-audio" ref={audioRef} controls preload="none" aria-label="Generated Vietnamese speech" />
          {notice && <p className="liveVoiceLab-notice" role="status">{notice}</p>}
          {error && <p className="liveVoiceLab-error" role="alert">{error}</p>}
        </article>

        <aside className="liveVoiceLab-side">
          <section className="liveVoiceLab-serviceCard">
            <div className="liveVoiceLab-sideTitle">
              <span className="liveVoiceLab-eyebrow">LOCAL RUNTIME</span>
              <span className={`liveVoiceLab-statusDot ${ready ? "is-ready" : ""}`} />
            </div>
            <h2>What is running here</h2>
            <div className="liveVoiceLab-serviceRow">
              <span className="liveVoiceLab-serviceIcon">IN</span>
              <div><strong>Fun-ASR-MLT-Nano-2512</strong><small>Vietnamese speech · final result only</small></div>
              <b className={services.asr.online ? "is-up" : "is-down"}>{services.asr.online ? "UP" : "DOWN"}</b>
            </div>
            <div className="liveVoiceLab-serviceRow">
              <span className="liveVoiceLab-serviceIcon">OUT</span>
              <div><strong>VieNeu-TTS · {services.tts.model}</strong><small>{services.tts.backend ? `${services.tts.backend} · 48 kHz` : "Vietnamese speech output"}</small></div>
              <b className={services.tts.online ? "is-up" : "is-down"}>{services.tts.online ? "UP" : "DOWN"}</b>
            </div>
          </section>

          <section className="liveVoiceLab-metricsCard">
            <div className="liveVoiceLab-sideTitle"><span className="liveVoiceLab-eyebrow">LATEST TURN</span><span className="liveVoiceLab-metricHint">LOCAL TIMINGS</span></div>
            <div className="liveVoiceLab-metrics">
              <div><span>ASR request</span><strong>{formatMs(asrRoundTripMs)}</strong></div>
              <div><span>ASR model</span><strong>{formatMs(asrModelMs)}</strong></div>
              <div><span>TTS first byte</span><strong>{formatMs(ttsFirstByteMs)}</strong></div>
              <div><span>TTS full audio</span><strong>{formatMs(ttsTotalMs)}</strong></div>
            </div>
            <p>First-byte is server time to the first returned audio chunk. Full audio includes local transfer and buffering; playback starts after the WAV is ready.</p>
          </section>

          <section className="liveVoiceLab-compareCard">
            <div className="liveVoiceLab-sideTitle"><span className="liveVoiceLab-eyebrow">WHAT TO TRY NEXT</span><span className="liveVoiceLab-metricHint">SHORTLIST</span></div>
            <div className="liveVoiceLab-candidate"><span className="liveVoiceLab-candidateMark">A</span><div><strong>Qwen3-ASR 0.6B</strong><small>Vietnamese · streaming ASR · new local runtime needed</small></div><b>INPUT</b></div>
            <div className="liveVoiceLab-candidate"><span className="liveVoiceLab-candidateMark">B</span><div><strong>MiniCPM-o 4.5</strong><small>Full duplex · real-time voice documented for English/Chinese</small></div><b>CHECK</b></div>
            <div className="liveVoiceLab-candidate"><span className="liveVoiceLab-candidateMark">C</span><div><strong>Qwen3-Omni</strong><small>Vietnamese listening · no Vietnamese speech output listed</small></div><b>GAP</b></div>
            <div className="liveVoiceLab-candidate"><span className="liveVoiceLab-candidateMark">D</span><div><strong>MOSS-TTS family</strong><small>v1.5 lists Vietnamese; 100M CPU Nano does not</small></div><b>VOICE</b></div>
            <Link className="liveVoiceLab-reportLink" href="/api/voice-lab/survey" target="_blank">
              Read the full model survey <span>↗</span>
            </Link>
          </section>
        </aside>
      </section>

      <section className="liveVoiceLab-history" aria-label="Recent measurements">
        <div className="liveVoiceLab-historyHeader">
          <div><span className="liveVoiceLab-eyebrow">RECENT MEASUREMENTS</span><h2>One turn at a time</h2></div>
          <button type="button" className="liveVoiceLab-clear" onClick={() => setRuns([])} disabled={!sortedRuns.length}>Clear results</button>
        </div>
        {sortedRuns.length ? (
          <div className="liveVoiceLab-tableWrap">
            <table className="liveVoiceLab-table">
              <thead><tr><th>Transcript</th><th>Audio</th><th>ASR total</th><th>ASR model</th><th>TTS first byte</th><th>TTS total</th></tr></thead>
              <tbody>{sortedRuns.map((run) => <tr key={run.id}>
                <td>{run.transcript}</td><td>{run.audioSeconds === null ? "—" : `${run.audioSeconds.toFixed(1)}s`}</td>
                <td>{formatMs(run.asrRoundTripMs)}</td><td>{formatMs(run.asrModelMs)}</td>
                <td>{formatMs(run.ttsFirstByteMs)}</td><td>{formatMs(run.ttsTotalMs)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <p className="liveVoiceLab-emptyHistory">Your last eight runs will appear here. Results remain in this page only.</p>}
      </section>

      <footer className="liveVoiceLab-footer">
        <span>NO PAID API <i /> LOOPBACK SERVICES <i /> EXPLICIT MIC PERMISSION</span>
        <span>FULL-DUPLEX TESTING IS A SEPARATE NEXT STEP</span>
      </footer>
    </main>
  );
}
