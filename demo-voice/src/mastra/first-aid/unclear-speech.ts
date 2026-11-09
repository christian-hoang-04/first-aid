import type { MastraDBMessage } from '@mastra/core/memory';
import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';

/** Từ đệm khi người dùng ngập ngừng: riêng chúng không mang ý nghĩa. */
const FILLERS = new Set(['ờ', 'ừm', 'ừ m', 'à', 'ơ', 'hả', 'hử', 'ủa', 'ê', 'um', 'uh', 'ah', 'hmm', 'ừ ừ']);

/** Câu STT hay "bịa" ra khi chỉ nghe thấy tạp âm hoặc im lặng. */
const NOISE_HALLUCINATIONS = [
  'subscribe',
  'đăng ký kênh',
  'theo dõi kênh',
  'cảm ơn các bạn đã theo dõi',
  'cảm ơn các bạn đã xem',
  'hẹn gặp lại các bạn',
  'like và share',
  'ghiền mì gõ',
];

function normalize(text: string) {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Câu nhận dạng không đủ rõ để hành động: rỗng, chỉ có từ đệm, câu ảo giác của STT, hoặc lặp một từ. */
export function isUnclearTranscript(text: string) {
  const normalized = normalize(text);
  if (!normalized || !/\p{L}/u.test(normalized)) return true;
  if (FILLERS.has(normalized)) return true;
  if (NOISE_HALLUCINATIONS.some((phrase) => normalized.includes(phrase))) return true;
  const words = normalized.split(' ');
  return words.length >= 6 && new Set(words).size <= 2;
}

function messageText(message: MastraDBMessage) {
  const parts = message.content.parts ?? [];
  const text = parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join(' ');
  return text || message.content.content || '';
}

/**
 * Với voice agent: nếu câu vừa nghe không rõ, khoá tool ở lượt đó (không thể mở hướng dẫn từ một câu
 * nghe nhầm) và không để model tạo câu trả lời từ transcript thiếu tin cậy.
 */
export class UnclearSpeechProcessor implements Processor {
  id = 'unclear-speech';

  async processInputStep({ stepNumber, messages, systemMessages }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    if (stepNumber !== 0) return {};
    const lastUser = messages.findLast((message) => message.role === 'user');
    if (!lastUser || !isUnclearTranscript(messageText(lastUser))) return {};
    return {
      toolChoice: 'none',
      systemMessages: [
        ...systemMessages,
        {
          role: 'system',
          content:
            'Câu người dùng vừa nói nhận dạng không rõ. Đừng đoán ý, đừng gọi tool và tuyệt đối không tạo câu trả lời bằng văn bản hoặc giọng nói. Hãy chờ lượt nói rõ tiếp theo.',
        },
      ],
    };
  }
}
