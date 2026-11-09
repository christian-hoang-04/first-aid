import type { UIDataTypes, UIMessage } from "ai"
import { z } from "zod"

import { FIRST_AID_GUIDES, getGuide, guideIdSchema, type GuideId } from "./guides"

// Định nghĩa tool dùng chung cho voice agent (chạy trong worker) và chat agent (client tool trên trình duyệt).

export const TOOL_DESCRIPTIONS = {
  listFirstAidGuides: "Liệt kê các hướng dẫn sơ cứu có animation, kèm tình huống áp dụng và tên các bước.",
  showFirstAidStep:
    "Mở một hướng dẫn sơ cứu tại bước chỉ định: giao diện chuyển animation và hiển thị/đọc nguyên văn bước đó.",
  navigateFirstAidStep:
    "Chuyển sang bước tiếp theo, quay lại bước trước hoặc lặp lại bước hiện tại của hướng dẫn đang mở trên giao diện.",
}

export const listGuidesInputSchema = z.object({})
export const listGuidesOutputSchema = z.object({
  guides: z.array(
    z.object({
      guideId: guideIdSchema,
      title: z.string(),
      method: z.string(),
      whenToUse: z.string(),
      steps: z.array(z.string()),
    }),
  ),
})

export const showStepInputSchema = z.object({
  guideId: guideIdSchema,
  step: z.number().int().min(1).describe("Số thứ tự bước, bắt đầu từ 1"),
})

export const navigateInputSchema = z.object({
  direction: z.enum(["next", "previous", "repeat"]),
})
export type NavigateDirection = z.infer<typeof navigateInputSchema>["direction"]

export const stepResultSchema = z.object({
  guideId: guideIdSchema,
  guideTitle: z.string(),
  step: z.number(),
  totalSteps: z.number(),
  title: z.string(),
  text: z.string(),
  isLastStep: z.boolean(),
})
export type StepResult = z.infer<typeof stepResultSchema>

export const toolErrorSchema = z.object({ error: z.string() })
export const stepOutputSchema = stepResultSchema.or(toolErrorSchema)
export type StepOutput = z.infer<typeof stepOutputSchema>

export function listGuides(): z.infer<typeof listGuidesOutputSchema> {
  return {
    guides: FIRST_AID_GUIDES.map((guide) => ({
      guideId: guide.id,
      title: guide.title,
      method: guide.method,
      whenToUse: guide.whenToUse,
      steps: guide.steps.map((step) => step.title),
    })),
  }
}

/** Nội dung bước lấy nguyên văn từ dữ liệu gốc; LLM dùng trường `text` để trả lời câu hỏi tiếp theo. */
export function stepResult(guideId: GuideId, stepIndex: number): StepResult {
  const guide = getGuide(guideId)
  const step = guide.steps[stepIndex]
  return {
    guideId,
    guideTitle: `${guide.title} – ${guide.method}`,
    step: stepIndex + 1,
    totalSteps: guide.steps.length,
    title: step.title,
    text: step.text,
    isLastStep: stepIndex === guide.steps.length - 1,
  }
}

/** Chặn số bước vượt phạm vi của guide. */
export function clampStep(guideId: GuideId, stepIndex: number) {
  return Math.min(Math.max(stepIndex, 0), getGuide(guideId).steps.length - 1)
}

/** Bước đích khi điều hướng tương đối, hoặc lỗi để agent giải thích cho người dùng. */
export function navigateTarget(
  state: { guideId?: GuideId; stepIndex?: number },
  direction: NavigateDirection,
): { guideId: GuideId; stepIndex: number } | { error: string } {
  if (!state.guideId) return { error: "Chưa mở hướng dẫn nào. Hãy hỏi tình huống rồi dùng showFirstAidStep." }
  const current = state.stepIndex ?? 0
  const target = current + { next: 1, previous: -1, repeat: 0 }[direction]
  const total = getGuide(state.guideId).steps.length
  if (target >= total) return { error: `Đã ở bước cuối (bước ${total}) của hướng dẫn.` }
  if (target < 0) return { error: "Đang ở bước đầu tiên của hướng dẫn." }
  return { guideId: state.guideId, stepIndex: target }
}

/** Kiểu message của useChat: biết input/output từng tool nên không cần ép kiểu ở client. */
export type FirstAidUITools = {
  listFirstAidGuides: { input: z.infer<typeof listGuidesInputSchema>; output: z.infer<typeof listGuidesOutputSchema> }
  showFirstAidStep: { input: z.infer<typeof showStepInputSchema>; output: StepOutput }
  navigateFirstAidStep: { input: z.infer<typeof navigateInputSchema>; output: StepOutput }
}
export type FirstAidUIMessage = UIMessage<unknown, UIDataTypes, FirstAidUITools>
