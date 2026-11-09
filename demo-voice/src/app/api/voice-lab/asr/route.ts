import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ASR_FALLBACK = "http://127.0.0.1:7860/api/transcribe";

function getLocalAsrUrl() {
  const url = new URL(process.env.FUNASR_STT_URL || ASR_FALLBACK);
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("The voice lab only sends audio to a local ASR service.");
  }
  return url;
}

type AsrPayload = {
  duration?: number;
  results?: Array<{
    model?: string;
    text?: string;
    seconds?: number;
    error?: string;
  }>;
};

export async function POST(request: Request) {
  const startedAt = performance.now();
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the audio upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a non-empty audio recording." }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Recording is too large (20 MB maximum)." }, { status: 413 });
  }

  try {
    const upstreamForm = new FormData();
    upstreamForm.append("file", file, "voice-lab.wav");
    upstreamForm.append("models", "funasr");

    const upstream = await fetch(getLocalAsrUrl(), {
      method: "POST",
      body: upstreamForm,
      cache: "no-store",
      signal: request.signal,
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Local FunASR returned HTTP ${upstream.status}.` },
        { status: 502 },
      );
    }

    const payload = (await upstream.json()) as AsrPayload;
    const result = payload.results?.find((item) => item.model === "funasr");
    if (!result || typeof result.text !== "string") {
      return NextResponse.json(
        { error: result?.error ?? "Local FunASR returned no transcript." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        text: result.text,
        audioSeconds: payload.duration ?? null,
        modelMs: typeof result.seconds === "number" ? result.seconds * 1000 : null,
        requestMs: performance.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not reach the local FunASR service at 127.0.0.1:7860." },
      { status: 503 },
    );
  }
}
