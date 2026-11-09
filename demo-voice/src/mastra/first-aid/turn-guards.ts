import { voice } from '@livekit/agents';

/**
 * Giới hạn một "lượt" của người dùng: cộng dồn qua các lượt liên tiếp và chỉ reset khi agent nói
 * được, nên cũng bắt được trường hợp người dùng cứ nói chen làm agent không trả lời được.
 * (STT không streaming nên số từ chỉ được đếm mỗi khi người dùng ngắt hơi.)
 */
export const USER_TURN_LIMIT = { maxDuration: 20_000, maxWords: 60 };

/** Người dùng nói liền quá lâu mà chưa ngắt hơi (theo VAD, chưa có transcript). */
const CONTINUOUS_SPEECH_MS = 20_000;
/** Không cắt ngang hai lần quá gần nhau. */
const CUT_IN_COOLDOWN_MS = 15_000;

// Câu cắt ngang ngắn để phát nhanh; lời trấn an do câu trả lời ngay sau đó của agent đảm nhận
// (nếu câu này cũng trấn an thì model sẽ trấn an lặp lại).
const CALM_CUT_IN = 'Tôi đã nghe rõ rồi.';
const CALM_CUT_IN_NO_TRANSCRIPT =
  'Bạn bình tĩnh, tôi vẫn đang nghe. Bạn dừng lại một chút và cho tôi biết nạn nhân bị làm sao nhé.';

/**
 * Cắt ngang khi người dùng hoảng loạn nói không ngừng: nói một câu trấn an cố định (không bị ngắt),
 * rồi xử lý những gì họ vừa nói như một lượt bình thường (agent có thể mở hướng dẫn ngay).
 */
export function attachLongSpeechGuards(session: voice.AgentSession, agent: voice.Agent) {
  let lastCutIn = 0;
  const canCutIn = () => Date.now() - lastCutIn > CUT_IN_COOLDOWN_MS;

  // Có transcript: LiveKit gọi hook này khi vượt USER_TURN_LIMIT.
  agent.onUserTurnExceeded = async (event) => {
    if (!canCutIn()) return;
    lastCutIn = Date.now();
    session.say(CALM_CUT_IN, { allowInterruptions: false });
    session.generateReply({ userInput: event.transcript, allowInterruptions: false });
  };

  // Chưa có transcript: người dùng nói liền một mạch không ngắt hơi.
  let speakingTimer: ReturnType<typeof setTimeout> | undefined;
  session.on(voice.AgentSessionEventTypes.UserStateChanged, (event) => {
    clearTimeout(speakingTimer);
    if (event.newState !== 'speaking') return;
    speakingTimer = setTimeout(() => {
      if (!canCutIn()) return;
      lastCutIn = Date.now();
      session.say(CALM_CUT_IN_NO_TRANSCRIPT, { allowInterruptions: false });
    }, CONTINUOUS_SPEECH_MS);
  });
  session.on(voice.AgentSessionEventTypes.Close, () => clearTimeout(speakingTimer));
}
