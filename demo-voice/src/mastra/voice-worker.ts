import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit/worker';
import { z } from 'zod';
import { GREETING, LIVEKIT_AGENT_NAME } from '../lib/voice-events';
import { USER_AWAY_SECONDS, attachSilenceCheckIn } from './first-aid/check-in';
import { callStateOf, liveKitGuideBridge, registerVoiceSession } from './first-aid/client-bridge';
import { USER_TURN_LIMIT, attachLongSpeechGuards } from './first-aid/turn-guards';
import { setVoiceGuideBridge } from './first-aid/voice-bridge';
import { FunAsrSTT } from './funasr-stt';
import { mastra } from './index';
import { OpenRouterTTS } from './openrouter-tts';

// Tool của voice agent điều khiển giao diện qua LiveKit (RPC, attributes, session.say).
setVoiceGuideBridge(liveKitGuideBridge);

// STT uses local FunASR; TTS can use its own endpoint without changing OpenRouter chat.
const env = z
  .object({
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
    TTS_BASE_URL: z.string().url().optional(),
    FUNASR_STT_URL: z.string().url().default('http://127.0.0.1:7860/api/transcribe'),
    OPENROUTER_TTS_MODEL: z.string().default('microsoft/mai-voice-2.1-flash'),
    OPENROUTER_TTS_VOICE: z.string().default('vi-VN-Harper:MAI-Voice-2.1-Flash'),
    // OpenRouter speed setting; the local VieNeu API accepts but ignores this field.
    OPENROUTER_TTS_SPEED: z.coerce.number().positive().default(1.2),
    OPENROUTER_TTS_SAMPLE_RATE: z.coerce.number().int().positive().default(24000),
    VOICE_LANGUAGE: z.string().default('vi'),
  })
  .parse(process.env);

function requireApiKey() {
  if (!env.OPENROUTER_API_KEY) throw new Error('Chưa điền OPENROUTER_API_KEY trong .env');
  return env.OPENROUTER_API_KEY;
}

export default createLiveKitWorker({
  mastra,
  agent: 'voiceAgent',
  // Turn detector đa ngôn ngữ của LiveKit chưa hỗ trợ tiếng Việt, nên dùng VAD.
  turnDetection: 'vad',
  configuration: {
    greeting: { text: GREETING },
    // Tạo TTS khi bắt đầu cuộc gọi để lệnh CLI (download-files, --help) chạy được khi chưa có key.
    // STT không streaming: LiveKit dùng VAD để cắt đoạn rồi gửi từng đoạn WAV đi nhận dạng.
    stt: () => new FunAsrSTT(env.FUNASR_STT_URL),
    tts: () =>
      new OpenRouterTTS({
        baseURL: env.TTS_BASE_URL ?? env.OPENROUTER_BASE_URL,
        apiKey: requireApiKey(),
        model: env.OPENROUTER_TTS_MODEL,
        voice: env.OPENROUTER_TTS_VOICE,
        instructions: 'Nói tiếng Việt tự nhiên, thân thiện, tốc độ vừa phải.',
        speed: env.OPENROUTER_TTS_SPEED,
        sampleRate: env.OPENROUTER_TTS_SAMPLE_RATE,
      }),
  },
  turnHandling: {
    // Cắt ngang khi người dùng nói quá lâu hoặc cứ nói chen làm agent không trả lời được.
    userTurnLimit: USER_TURN_LIMIT,
    // Tiếng kêu ngắn ("trời ơi", tiếng nấc) không làm agent dừng giữa câu.
    interruption: { minDuration: 800 },
  },
  sessionOptions: { userAwayTimeout: USER_AWAY_SECONDS },
  onSessionStart: ({ session, ctx, agent }) => {
    attachSilenceCheckIn(session, () => callStateOf(ctx.room));
    attachLongSpeechGuards(session, agent);
    const unregister = registerVoiceSession(ctx.room, session);
    ctx.addShutdownCallback(async () => {
      unregister();
    });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({
    entry: import.meta.url,
    agentName: LIVEKIT_AGENT_NAME,
    // Worker local chỉ phục vụ một cuộc gọi; tránh ngưỡng CPU production từ chối dispatch trên laptop.
    // Giữ sẵn một job process để nhận cuộc gọi ngay, không cần khởi tạo chậm sau khi dispatch.
    serverOptions: { initializeProcessTimeout: 60_000, loadFunc: async () => 0, numIdleProcesses: 1 },
  });
}
