/** Tool mà hệ thống tự đọc nội dung (bước hướng dẫn, câu trả lời trích dẫn, phiếu bàn giao) qua TTS. */
const SYSTEM_SPEECH_TOOLS = new Set([
  'proposeFirstAidGuide',
  'confirmFirstAidGuide',
  'showFirstAidStep',
  'navigateFirstAidStep',
  'answerFromGuide',
  'handOff',
]);

interface StepToolResults {
  toolResults: Array<{ toolName: string; output?: unknown }>;
}

const isToolError = (output: unknown) => typeof output === 'object' && output !== null && 'error' in output;

/**
 * Điều kiện dừng vòng lặp của voice agent: tool vừa chạy đã tự đọc nội dung thì kết thúc lượt ngay,
 * không gọi LLM thêm lần nữa để sinh câu dẫn. Bước được đọc sớm hơn vài giây và LLM không có cơ hội
 * diễn đạt lại nội dung bước. Tool trả lỗi (ví dụ đã ở bước cuối) thì vẫn để LLM giải thích.
 */
export function stopAfterSystemSpeech({ steps }: { steps: StepToolResults[] }) {
  const last = steps.at(-1);
  return last?.toolResults.some((result) => SYSTEM_SPEECH_TOOLS.has(result.toolName) && !isToolError(result.output)) ?? false;
}
