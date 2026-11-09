import { voice } from '@livekit/agents';
import type { CallPhase, CallState } from '../../lib/first-aid/call-state';

/** Số giây người dùng im lặng (sau khi agent nói xong) trước khi trợ lý hỏi thăm. */
export const USER_AWAY_SECONDS = 15;

/** Câu hỏi thăm cố định (không qua LLM) theo giai đoạn cuộc gọi; bàn giao thì không hỏi thăm. */
const CHECK_IN: Record<CallPhase, string | undefined> = {
  triage: 'Tôi vẫn đang ở đây. Bạn hãy kể cho tôi chuyện gì đang xảy ra với nạn nhân.',
  confirming: undefined,
  guiding: 'Bạn làm được bước này chưa? Nói "tiếp" để sang bước sau, hoặc "nhắc lại" nếu cần tôi đọc lại.',
  monitoring: 'Nạn nhân giờ thế nào rồi? Còn tỉnh và còn thở không?',
  handoff: undefined,
};
/** Không hỏi thăm dồn dập: tối đa 2 lần cho mỗi bước hoặc giai đoạn, 1 lần khi đang phân loại. */
const MAX_CHECK_INS: Record<CallPhase, number> = { triage: 1, confirming: 0, guiding: 2, monitoring: 2, handoff: 0 };

/** Hỏi thăm khi người dùng im lặng quá lâu. */
export function attachSilenceCheckIn(session: voice.AgentSession, readState: () => CallState | undefined) {
  let key = '';
  let count = 0;
  session.on(voice.AgentSessionEventTypes.UserStateChanged, (event) => {
    if (event.newState !== 'away') return;
    const state = readState();
    if (!state) return;
    const current = `${state.phase}:${state.guideId ?? ''}:${state.stepIndex ?? ''}`;
    if (current !== key) {
      key = current;
      count = 0;
    }
    const text = CHECK_IN[state.phase];
    if (!text || count >= MAX_CHECK_INS[state.phase]) return;
    count++;
    session.say(text);
  });
}
