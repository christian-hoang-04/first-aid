import { getJobContext, type voice } from '@livekit/agents';
import { z } from 'zod';
import { OpenRouterTTS } from '../openrouter-tts';
import {
  CALL_ATTRIBUTE,
  RED_FLAG_LINE,
  createCallState,
  reduceCall,
  type CallEvent,
  type CallState,
} from '../../lib/first-aid/call-state';
import {
  FIRST_AID_GUIDES,
  GUIDE_ATTRIBUTE,
  SHOW_STEP_RPC,
  getGuide,
  guideIntro,
  guideIdSchema,
  stepSpeech,
  type ShowStepPayload,
} from '../../lib/first-aid/guides';
import { USER_IDENTITY_PREFIX } from '../../lib/voice-events';
import type { VoiceGuideBridge } from './voice-bridge';

type Room = NonNullable<ReturnType<typeof getJobContext>>['room'];

interface CallEntry {
  room: Room;
  session: voice.AgentSession;
  state: CallState;
  /** Bước giao diện đã biết lần cuối (do agent đẩy qua RPC hoặc đọc từ attributes). */
  lastUi: { guideId?: string; stepIndex?: number };
}

// Mỗi job LiveKit chạy trong process riêng, map này chỉ chứa cuộc gọi của các room trong process đó.
const calls = new Map<string, CallEntry>();

export function registerVoiceSession(room: Room, session: voice.AgentSession) {
  const key = room.name ?? '';
  const call: CallEntry = { room, session, state: createCallState(), lastUi: {} };
  calls.set(key, call);
  void publishCallState(call, '');
  // Câu có thể phải đọc ngay đầu cuộc gọi: bước đầu của mỗi guide (và bước cho nạn nhân bất tỉnh), câu nhắc 115.
  for (const guide of FIRST_AID_GUIDES) {
    prefetchSpeech(session, guideIntro(guide));
    prefetchSpeech(session, stepSpeech(guide, 0));
    if (guide.unconsciousStep !== undefined) prefetchSpeech(session, stepSpeech(guide, guide.unconsciousStep));
  }
  prefetchSpeech(session, RED_FLAG_LINE);
  return () => calls.delete(key);
}

/** Tổng hợp sẵn audio khi TTS của phiên hỗ trợ (OpenRouterTTS). */
function prefetchSpeech(session: voice.AgentSession, text: string) {
  if (session.tts instanceof OpenRouterTTS) session.tts.prefetch(text);
}

/**
 * Đọc nguyên văn một câu cố định. Truyền audio của cả câu (đã cache/tổng hợp sẵn) thay vì để LiveKit
 * tách câu rồi tổng hợp lại từng đoạn, nhờ vậy câu đã prefetch phát ngay.
 * Không ghi vào lịch sử hội thoại của LLM: nếu thấy "Bước N trên M…" như lời của chính mình, model bắt
 * chước và tự đọc bước bằng chữ thay vì gọi tool. Bước hiện tại đã có trong mô tả giai đoạn mỗi lượt.
 */
function sayVerbatim(session: voice.AgentSession, text: string, allowInterruptions: boolean) {
  const audio = session.tts instanceof OpenRouterTTS ? session.tts.speech(text) : undefined;
  session.say(text, { allowInterruptions, audio, addToChatCtx: false });
}

function currentCall() {
  // Tool của Mastra không phải lúc nào cũng chạy trong async context của job LiveKit, nên
  // getJobContext() có thể trống. Mỗi job chạy trong process riêng: khi đó chỉ có đúng một cuộc gọi.
  const room = getJobContext(false)?.room;
  const call = room ? calls.get(room.name ?? '') : calls.size === 1 ? calls.values().next().value : undefined;
  if (!call) throw new Error('Tool hướng dẫn sơ cứu chỉ chạy trong cuộc gọi LiveKit');
  return call;
}

function userParticipant(room: Room) {
  for (const participant of room.remoteParticipants.values()) {
    if (participant.identity.startsWith(USER_IDENTITY_PREFIX)) return participant;
  }
  throw new Error('Người dùng chưa có trong phòng');
}

const clientStateSchema = z.object({
  guideId: guideIdSchema.optional(),
  stepIndex: z.coerce.number().int().nonnegative().optional(),
});

/** Guide và bước giao diện đang hiển thị, đọc từ participant attributes do client đặt. */
export function readClientGuideState(room: Room) {
  const attributes = userParticipant(room).attributes;
  const result = clientStateSchema.safeParse({
    guideId: attributes[GUIDE_ATTRIBUTE.guide] || undefined,
    stepIndex: attributes[GUIDE_ATTRIBUTE.step] || undefined,
  });
  return result.success ? result.data : {};
}

const showStepResponseSchema = z.object({ ok: z.boolean(), error: z.string().optional() });

/** Client tool: yêu cầu giao diện mở guide và chuyển animation tới bước tương ứng. */
async function showStepOnClient(room: Room, payload: ShowStepPayload) {
  const localParticipant = room.localParticipant;
  if (!localParticipant) throw new Error('Agent chưa kết nối vào phòng');
  const response = await localParticipant.performRpc({
    destinationIdentity: userParticipant(room).identity,
    method: SHOW_STEP_RPC,
    payload: JSON.stringify(payload),
    responseTimeout: 5000,
  });
  const result = showStepResponseSchema.parse(JSON.parse(response));
  if (!result.ok) throw new Error(result.error ?? 'Giao diện không chuyển được bước');
}

/** Giao diện tự đọc giai đoạn và phiếu bàn giao từ attributes của agent. */
async function publishCallState(call: CallEntry, summary?: string) {
  await call.room.localParticipant
    ?.setAttributes({
      [CALL_ATTRIBUTE.phase]: call.state.phase,
      ...(summary !== undefined ? { [CALL_ATTRIBUTE.summary]: summary } : {}),
    })
    .catch((error) => console.warn('Không cập nhật được trạng thái cuộc gọi', error));
}

/** Chuyển trạng thái cuộc gọi rồi thực thi effect: câu nói cố định, chuyển bước (đọc nguyên văn). */
export async function dispatchCallEvent(call: CallEntry, event: CallEvent) {
  const { state, effects } = reduceCall(call.state, event);
  call.state = state;
  for (const effect of effects) {
    if (effect.type === 'say') {
      sayVerbatim(call.session, effect.text, effect.interruptible);
    } else {
      await showStepOnClient(call.room, { guideId: effect.guideId, stepIndex: effect.stepIndex });
      call.lastUi = { guideId: effect.guideId, stepIndex: effect.stepIndex };
      sayVerbatim(call.session, stepSpeech(getGuide(effect.guideId), effect.stepIndex), false);
    }
  }
  // Phiếu bàn giao chính là câu được đọc khi bàn giao; giao diện hiển thị lại để đưa nhân viên y tế xem.
  const summary = event.type === 'handoff' ? effects.flatMap((effect) => (effect.type === 'say' ? [effect.text] : []))[0] : undefined;
  await publishCallState(call, summary);
  return call.state;
}

/**
 * Đồng bộ bước người dùng tự bấm trên giao diện vào trạng thái cuộc gọi (không phát sinh effect).
 * Attributes tới chậm hơn RPC, nên chỉ áp dụng khi giao diện thật sự đổi so với lần cuối đã biết;
 * nhờ vậy giá trị cũ chưa kịp cập nhật không kéo trạng thái lùi về bước trước.
 */
function syncWithClient(call: CallEntry) {
  let ui: ReturnType<typeof readClientGuideState>;
  try {
    ui = readClientGuideState(call.room);
  } catch {
    return call.state;
  }
  if (!ui.guideId) return call.state;
  if (ui.guideId === call.lastUi.guideId && ui.stepIndex === call.lastUi.stepIndex) return call.state;
  call.lastUi = ui;
  if (ui.guideId !== call.state.guideId) {
    call.state = reduceCall(call.state, { type: 'guide-opened', guideId: ui.guideId, stepIndex: ui.stepIndex ?? 0 }).state;
  } else if (ui.stepIndex !== undefined && ui.stepIndex !== call.state.stepIndex && call.state.phase === 'guiding') {
    call.state = reduceCall(call.state, { type: 'step-changed', stepIndex: ui.stepIndex }).state;
  }
  return call.state;
}

/** Trạng thái cuộc gọi của một room (dùng ngoài job context, ví dụ handler sự kiện). */
export function callStateOf(room: Room) {
  const call = calls.get(room.name ?? '');
  return call ? syncWithClient(call) : undefined;
}

/** Implementation của VoiceGuideBridge qua LiveKit: attributes, RPC tới client và session.say(). */
export const liveKitGuideBridge: VoiceGuideBridge = {
  prefetch: (text) => prefetchSpeech(currentCall().session, text),
  showStep: async (payload) => {
    const call = currentCall();
    await showStepOnClient(call.room, payload);
    call.lastUi = payload;
  },
  // Đọc nguyên văn qua TTS, không qua LLM, để nội dung sơ cứu không bị diễn đạt sai.
  speak: (text, { interruptible = true } = {}) => {
    sayVerbatim(currentCall().session, text, interruptible);
  },
  callState: () => syncWithClient(currentCall()),
  dispatch: (event) => dispatchCallEvent(currentCall(), event),
};
