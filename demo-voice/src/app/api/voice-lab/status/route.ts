import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ASR_FALLBACK = "http://127.0.0.1:7860/api/transcribe";
const TTS_ORIGIN = "http://127.0.0.1:8000";

function localUrl(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("This demo only connects to services on this machine.");
  }
  return url;
}

async function getJson(url: URL) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`Service returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function GET() {
  let asrUrl: URL;
  try {
    asrUrl = localUrl(process.env.FUNASR_STT_URL, ASR_FALLBACK);
  } catch {
    return NextResponse.json({
      asr: { online: false, model: "Fun-ASR-MLT-Nano-2512", streaming: false },
      tts: { online: false, model: "vieneu-v3-turbo", voices: [] },
    });
  }

  const [asrResult, ttsHealthResult, ttsModelsResult, ttsVoicesResult] =
    await Promise.allSettled([
      getJson(new URL("/openapi.json", asrUrl)),
      getJson(new URL("/health", TTS_ORIGIN)),
      getJson(new URL("/v1/models", TTS_ORIGIN)),
      getJson(new URL("/v1/voices", TTS_ORIGIN)),
    ]);

  const ttsHealth =
    ttsHealthResult.status === "fulfilled" ? ttsHealthResult.value : null;
  const ttsModels =
    ttsModelsResult.status === "fulfilled" ? ttsModelsResult.value : null;
  const ttsVoices =
    ttsVoicesResult.status === "fulfilled" ? ttsVoicesResult.value : null;
  const modelList = Array.isArray(ttsModels?.data) ? ttsModels.data : [];
  const voiceList = Array.isArray(ttsVoices?.data) ? ttsVoices.data : [];
  const firstModel = modelList[0] as
    | { id?: string; backend?: string }
    | undefined;

  return NextResponse.json(
    {
      asr: {
        online: asrResult.status === "fulfilled",
        model: "Fun-ASR-MLT-Nano-2512",
        streaming: false,
      },
      tts: {
        online: ttsHealthResult.status === "fulfilled" && Boolean(ttsHealth),
        model: firstModel?.id ?? "vieneu-v3-turbo",
        backend:
          (ttsHealth?.backend as string | undefined) ?? firstModel?.backend ?? null,
        voices: voiceList,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
