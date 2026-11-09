import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ANSWER_DESCRIPTION, answerInputSchema, composeAnswer } from '../../lib/first-aid/answer';
import { handoffSummary, victimSignsSchema } from '../../lib/first-aid/call-state';
import { getGuide, guideIdSchema, guideIntro, stepSpeech, type GuideId } from '../../lib/first-aid/guides';
import {
  TOOL_DESCRIPTIONS,
  clampStep,
  listGuides,
  listGuidesInputSchema,
  listGuidesOutputSchema,
  navigateInputSchema,
  navigateTarget,
  showStepInputSchema,
  stepOutputSchema,
  stepResult,
  toolErrorSchema,
} from '../../lib/first-aid/tools';
import { voiceGuideBridge } from './voice-bridge';

const listFirstAidGuides = createTool({
  id: 'list-first-aid-guides',
  description: TOOL_DESCRIPTIONS.listFirstAidGuides,
  inputSchema: listGuidesInputSchema,
  outputSchema: listGuidesOutputSchema,
  execute: async () => listGuides(),
});

/** Voice agent: chuyển bước trên giao diện qua RPC, đọc nguyên văn bằng TTS, cập nhật trạng thái cuộc gọi. */
async function presentStepByVoice(guideId: GuideId, stepIndex: number) {
  const bridge = voiceGuideBridge();
  const before = bridge.callState();
  const unconsciousStep = getGuide(guideId).unconsciousStep;
  // Đã biết nạn nhân bất tỉnh: yêu cầu bước 1 (tư thế nạn nhân còn đứng) chuyển thẳng tới bước dành cho
  // nạn nhân bất tỉnh, dù là mở mới hay model gọi lại guide đang mở.
  const index =
    stepIndex === 0 && before.signs.awake === false && unconsciousStep !== undefined
      ? unconsciousStep
      : clampStep(guideId, stepIndex);
  await bridge.showStep({ guideId, stepIndex: index });
  // Vừa chuyển từ màn hình chính sang hướng dẫn: nhắc người dùng làm theo từng bước trước khi đọc bước.
  if (before.guideId !== guideId) bridge.speak(guideIntro(getGuide(guideId)), { interruptible: false });
  // Bước đầu tiên đọc trọn vẹn (người hoảng loạn hay nói chen); các bước sau cho ngắt để nói "xong", "nhắc lại".
  bridge.speak(stepSpeech(getGuide(guideId), index), { interruptible: index !== 0 });
  // Trong lúc người dùng làm bước này, tổng hợp sẵn bước kế tiếp để "xong" là đọc ngay.
  if (index + 1 < getGuide(guideId).steps.length) bridge.prefetch(stepSpeech(getGuide(guideId), index + 1));
  await bridge.dispatch(
    before.guideId === guideId ? { type: 'step-changed', stepIndex: index } : { type: 'guide-opened', guideId, stepIndex: index },
  );
  return stepResult(guideId, index);
}

const guideCompletedSchema = z.object({ completed: z.literal(true), note: z.string() });
const guideProposalOutputSchema = z
  .object({
    status: z.enum(['awaiting_confirmation', 'started']),
    guideId: guideIdSchema,
    guideTitle: z.string(),
    question: z.string().optional(),
  })
  .or(toolErrorSchema);

export const voiceFirstAidTools = {
  listFirstAidGuides,
  proposeFirstAidGuide: createTool({
    id: 'propose-first-aid-guide',
    description:
      'Đề xuất hướng dẫn sơ cứu phù hợp. Với tình huống chưa nguy kịch, hệ thống hỏi người dùng xác nhận bằng giọng nói trước khi mở hướng dẫn. Nếu nạn nhân bất tỉnh hoặc không thở, hệ thống mở hướng dẫn ngay và không chờ xác nhận.',
    inputSchema: z.object({ guideId: guideIdSchema }),
    outputSchema: guideProposalOutputSchema,
    execute: async ({ guideId }) => {
      const bridge = voiceGuideBridge();
      const state = bridge.callState();
      const guide = getGuide(guideId);
      if (state.phase !== 'triage') return { error: 'Chỉ có thể đề xuất hướng dẫn khi đang phân loại tình huống.' };

      if (state.signs.awake === false || state.signs.breathing === false) {
        await presentStepByVoice(guideId, 0);
        return { status: 'started' as const, guideId, guideTitle: guide.title };
      }

      await bridge.dispatch({ type: 'guide-proposed', guideId });
      const question = `Tôi hiểu là tình huống cần hướng dẫn ${guide.title.toLowerCase()}. Có đúng không?`;
      bridge.speak(question, { interruptible: true });
      return { status: 'awaiting_confirmation' as const, guideId, guideTitle: guide.title, question };
    },
  }),
  confirmFirstAidGuide: createTool({
    id: 'confirm-first-aid-guide',
    description: 'Mở hướng dẫn đang chờ xác nhận sau khi người dùng nói rõ là đúng hoặc đồng ý.',
    inputSchema: z.object({}),
    outputSchema: stepOutputSchema,
    execute: async () => {
      const state = voiceGuideBridge().callState();
      if (state.phase !== 'confirming' || !state.pendingGuideId) return { error: 'Hiện không có hướng dẫn nào đang chờ xác nhận.' };
      return presentStepByVoice(state.pendingGuideId, 0);
    },
  }),
  rejectFirstAidGuide: createTool({
    id: 'reject-first-aid-guide',
    description: 'Hủy đề xuất hướng dẫn khi người dùng nói không đúng hoặc sửa lại tình huống; sau đó chờ thêm thông tin, không tạo câu hỏi bằng lời model.',
    inputSchema: z.object({}),
    outputSchema: z.object({ rejected: z.literal(true), note: z.string() }).or(toolErrorSchema),
    execute: async () => {
      const bridge = voiceGuideBridge();
      const state = bridge.callState();
      if (state.phase !== 'confirming' || !state.pendingGuideId) return { error: 'Hiện không có đề xuất nào để hủy.' };
      await bridge.dispatch({ type: 'guide-rejected' });
      return { rejected: true as const, note: 'Đề xuất đã được hủy; chờ người dùng mô tả thêm tình huống, không tạo câu trả lời.' };
    },
  }),
  showFirstAidStep: createTool({
    id: 'show-first-aid-step',
    description: TOOL_DESCRIPTIONS.showFirstAidStep,
    inputSchema: showStepInputSchema,
    outputSchema: stepOutputSchema,
    execute: async ({ guideId, step }) => presentStepByVoice(guideId, step - 1),
  }),
  navigateFirstAidStep: createTool({
    id: 'navigate-first-aid-step',
    description: TOOL_DESCRIPTIONS.navigateFirstAidStep,
    inputSchema: navigateInputSchema,
    outputSchema: stepOutputSchema.or(guideCompletedSchema),
    execute: async ({ direction }) => {
      const bridge = voiceGuideBridge();
      // Trạng thái cuộc gọi cập nhật ngay khi chuyển bước (đã gộp bước người dùng tự bấm), còn
      // attributes của giao diện tới chậm nên có thể vẫn là bước cũ.
      const ui = bridge.callState();
      // "Xong" ở bước cuối: hoàn thành hướng dẫn, chuyển sang theo dõi (hệ thống tự nói câu chuyển giai đoạn).
      if (direction === 'next' && ui.guideId && ui.stepIndex === getGuide(ui.guideId).steps.length - 1) {
        await bridge.dispatch({ type: 'guide-completed' });
        const completed: z.infer<typeof guideCompletedSchema> = {
          completed: true,
          note: 'Đã hoàn thành hướng dẫn, chuyển sang theo dõi nạn nhân. Hệ thống đã thông báo cho người dùng.',
        };
        return completed;
      }
      const target = navigateTarget(ui, direction);
      return 'error' in target ? target : presentStepByVoice(target.guideId, target.stepIndex);
    },
  }),
  answerFromGuide: createTool({
    id: 'answer-from-guide',
    description: ANSWER_DESCRIPTION,
    inputSchema: answerInputSchema,
    outputSchema: z.object({ spoken: z.string() }).or(toolErrorSchema),
    execute: async (input) => {
      const bridge = voiceGuideBridge();
      const state = bridge.callState();
      if (!state.guideId) return { error: 'Chưa mở hướng dẫn nào để trích dẫn.' };
      const answer = composeAnswer(getGuide(state.guideId), state.stepIndex ?? 0, input);
      if ('error' in answer) return answer;
      // Đọc câu ghép từ dữ liệu gốc; LLM không nói thêm (lượt kết thúc sau tool này).
      bridge.speak(answer.speech, { interruptible: true });
      return { spoken: answer.speech };
    },
  }),
  updateVictimSigns: createTool({
    id: 'update-victim-signs',
    description:
      'Ghi nhận tình trạng nạn nhân mà người dùng vừa mô tả (tỉnh hay bất tỉnh, còn thở không, còn nói/ho được không). ' +
      'Chỉ điền trường người dùng thật sự nói tới. Nếu nạn nhân nguy kịch, hệ thống tự nhắc gọi 115 và chuyển bước phù hợp.',
    inputSchema: victimSignsSchema,
    outputSchema: z.object({ phase: z.string(), signs: victimSignsSchema, handledBySystem: z.boolean() }),
    execute: async (signs) => {
      const bridge = voiceGuideBridge();
      const before = bridge.callState();
      const after = await bridge.dispatch({ type: 'signs-updated', signs });
      return {
        phase: after.phase,
        signs: after.signs,
        // Hệ thống đã tự nói (nhắc 115, chuyển bước): agent không cần lặp lại.
        handledBySystem: after.redFlagAnnounced !== before.redFlagAnnounced || after.stepIndex !== before.stepIndex,
      };
    },
  }),
  handOff: createTool({
    id: 'hand-off',
    description:
      'Bàn giao khi đội cấp cứu đã tới, đã tới cơ sở y tế hoặc người dùng muốn kết thúc: hệ thống đọc và hiển thị thông tin bàn giao.',
    inputSchema: z.object({}),
    outputSchema: z.object({ summary: z.string() }),
    execute: async () => {
      const bridge = voiceGuideBridge();
      const before = bridge.callState();
      await bridge.dispatch({ type: 'handoff' });
      return { summary: handoffSummary(before) };
    },
  }),
};

/** Chat agent: hai tool chuyển bước không có `execute` nên chạy ở trình duyệt (client tool của useChat). */
export const chatFirstAidTools = {
  listFirstAidGuides,
  showFirstAidStep: createTool({
    id: 'show-first-aid-step',
    description: TOOL_DESCRIPTIONS.showFirstAidStep,
    inputSchema: showStepInputSchema,
    outputSchema: stepOutputSchema,
  }),
  navigateFirstAidStep: createTool({
    id: 'navigate-first-aid-step',
    description: TOOL_DESCRIPTIONS.navigateFirstAidStep,
    inputSchema: navigateInputSchema,
    outputSchema: stepOutputSchema,
  }),
};
