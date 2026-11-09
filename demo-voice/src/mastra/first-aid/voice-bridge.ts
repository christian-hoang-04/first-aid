import type { CallEvent, CallState } from '../../lib/first-aid/call-state';
import type { ShowStepPayload } from '../../lib/first-aid/guides';

/**
 * Cầu nối từ tool của voice agent tới giao diện người dùng. Worker LiveKit đăng ký implementation
 * lúc khởi động, nhờ vậy cấu hình Mastra (cũng được chat route của Next.js import) không phụ thuộc
 * vào LiveKit.
 */
export interface VoiceGuideBridge {
  /** Client tool qua RPC: giao diện chuyển animation tới bước. */
  showStep(payload: ShowStepPayload): Promise<void>;
  /** Đọc nguyên văn qua TTS, không qua LLM. */
  speak(text: string, options?: { interruptible?: boolean }): void;
  /** Trạng thái cuộc gọi (giai đoạn, dấu hiệu nạn nhân), đã đồng bộ với bước đang hiển thị. */
  callState(): CallState;
  /** Chuyển trạng thái cuộc gọi và thực thi các việc đi kèm (câu nói cố định, chuyển bước). */
  dispatch(event: CallEvent): Promise<CallState>;
}

let bridge: VoiceGuideBridge | null = null;

export function setVoiceGuideBridge(implementation: VoiceGuideBridge) {
  bridge = implementation;
}

export function voiceGuideBridge() {
  if (!bridge) throw new Error('Tool này chỉ chạy trong voice worker');
  return bridge;
}

/** Bridge nếu đang chạy trong voice worker, ngược lại undefined (chat route, script kiểm thử). */
export function optionalVoiceGuideBridge() {
  return bridge ?? undefined;
}
