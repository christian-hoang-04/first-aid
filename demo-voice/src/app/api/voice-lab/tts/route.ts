import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TTS_URL = "http://127.0.0.1:8000/v1/audio/speech";

type TtsRequest = { text?: unknown; voice?: unknown };

export async function POST(request: Request) {
  let input: TtsRequest;
  try {
    input = (await request.json()) as TtsRequest;
  } catch {
    return NextResponse.json({ error: "Could not read the speech request." }, { status: 400 });
  }

  if (typeof input.text !== "string" || !input.text.trim()) {
    return NextResponse.json({ error: "Enter text to speak." }, { status: 400 });
  }
  if (input.text.length > 3000) {
    return NextResponse.json({ error: "Text is too long (3,000 characters maximum)." }, { status: 413 });
  }

  const startedAt = performance.now();
  try {
    const upstream = await fetch(TTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "vieneu-v3-turbo",
        input: input.text.trim(),
        ...(typeof input.voice === "string" && input.voice ? { voice: input.voice } : {}),
        response_format: "wav",
        stream_format: "audio",
        sample_rate: 48000,
      }),
      cache: "no-store",
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Local VieNeu TTS returned HTTP ${upstream.status}.` },
        { status: 502 },
      );
    }

    const reader = upstream.body.getReader();
    const first = await reader.read();
    const firstByteMs = performance.now() - startedAt;
    if (first.done) {
      return NextResponse.json({ error: "Local VieNeu TTS returned no audio." }, { status: 502 });
    }

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first.value);
        void (async () => {
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              controller.enqueue(chunk.value);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        })();
      },
      cancel(reason) {
        void reader.cancel(reason);
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "audio/wav",
        "Cache-Control": "no-store",
        "X-Voice-Lab-First-Byte-Ms": String(Math.round(firstByteMs)),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the local VieNeu TTS service at 127.0.0.1:8000." },
      { status: 503 },
    );
  }
}
