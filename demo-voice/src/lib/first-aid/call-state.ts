import { z } from "zod"

import { getGuide, stepLines, type GuideId } from "./guides"

/**
 * Máy trạng thái của một cuộc gọi sơ cứu. Code quyết định giai đoạn, tool được dùng và phản ứng với
 * dấu hiệu nguy hiểm; LLM chỉ hiểu lời người dùng và chọn hành động trong phạm vi giai đoạn cho phép.
 * Hàm thuần, không phụ thuộc LiveKit, để kiểm thử độc lập.
 */

export type CallPhase = "triage" | "confirming" | "guiding" | "monitoring" | "handoff"

export const PHASE_LABEL: Record<CallPhase, string> = {
  triage: "Phân loại",
  confirming: "Xác nhận",
  guiding: "Đang hướng dẫn",
  monitoring: "Theo dõi",
  handoff: "Bàn giao",
}

// strict: model gõ sai tên trường (ví dụ "consciousH") thì báo lỗi để model gọi lại, thay vì âm thầm mất dữ liệu.
export const victimSignsSchema = z
  .object({
    awake: z.boolean().optional().describe("true nếu nạn nhân còn tỉnh, false nếu bất tỉnh/ngất"),
    breathing: z.boolean().optional().describe("true nếu nạn nhân còn thở, false nếu không thở"),
    talking: z.boolean().optional().describe("true nếu nạn nhân còn nói hoặc ho được, false nếu không"),
  })
  .strict()
export type VictimSigns = z.infer<typeof victimSignsSchema>

export interface CallState {
  phase: CallPhase
  guideId?: GuideId
  pendingGuideId?: GuideId
  stepIndex?: number
  signs: VictimSigns
  /** Đã nhắc gọi 115 vì dấu hiệu nguy hiểm (chỉ nhắc một lần cho mỗi lần xấu đi). */
  redFlagAnnounced: boolean
  /** Các guide đã hoàn thành trong cuộc gọi. */
  completedGuides: GuideId[]
  startedAt: number
}

export type CallEvent =
  | { type: "guide-proposed"; guideId: GuideId }
  | { type: "guide-rejected" }
  | { type: "guide-opened"; guideId: GuideId; stepIndex: number }
  | { type: "step-changed"; stepIndex: number }
  | { type: "guide-completed" }
  | { type: "signs-updated"; signs: VictimSigns }
  | { type: "handoff" }

/** Việc worker phải làm sau khi chuyển trạng thái (câu nói cố định, chuyển bước). */
export type CallEffect =
  | { type: "say"; text: string; interruptible: boolean }
  | { type: "show-step"; guideId: GuideId; stepIndex: number }

export const RED_FLAG_LINE = "Nạn nhân đang rất nguy hiểm. Nếu chưa gọi, hãy gọi cấp cứu 115 ngay."
export const GUIDE_COMPLETED_LINE =
  "Bạn đã làm xong các bước hướng dẫn. Tôi vẫn ở đây cùng bạn, hãy cho tôi biết nếu tình trạng nạn nhân thay đổi."

export function createCallState(now = Date.now()): CallState {
  return { phase: "triage", signs: {}, redFlagAnnounced: false, completedGuides: [], startedAt: now }
}

const isCritical = (signs: VictimSigns) => signs.awake === false || signs.breathing === false

export function reduceCall(state: CallState, event: CallEvent): { state: CallState; effects: CallEffect[] } {
  switch (event.type) {
    case "guide-proposed":
      return {
        state: { ...state, phase: "confirming", pendingGuideId: event.guideId },
        effects: [],
      }
    case "guide-rejected":
      return { state: { ...state, phase: "triage", pendingGuideId: undefined }, effects: [] }
    case "guide-opened":
      return {
        state: { ...state, phase: "guiding", guideId: event.guideId, pendingGuideId: undefined, stepIndex: event.stepIndex },
        effects: [],
      }
    case "step-changed":
      return { state: { ...state, stepIndex: event.stepIndex, phase: state.guideId ? "guiding" : state.phase }, effects: [] }
    case "guide-completed": {
      const completedGuides =
        state.guideId && !state.completedGuides.includes(state.guideId) ? [...state.completedGuides, state.guideId] : state.completedGuides
      return {
        state: { ...state, phase: "monitoring", completedGuides },
        effects: [{ type: "say", text: GUIDE_COMPLETED_LINE, interruptible: true }],
      }
    }
    case "signs-updated": {
      const signs = { ...state.signs, ...event.signs }
      const next: CallState = { ...state, signs }
      const effects: CallEffect[] = []
      if (!isCritical(signs)) return { state: { ...next, redFlagAnnounced: false }, effects }
      if (!state.redFlagAnnounced) {
        effects.push({ type: "say", text: RED_FLAG_LINE, interruptible: false })
        next.redFlagAnnounced = true
      }
      // Guide đang mở có bước dành cho nạn nhân bất tỉnh: chuyển tới đó ngay.
      const pendingGuideId = state.phase === "confirming" ? state.pendingGuideId : undefined
      const guideId = state.guideId ?? pendingGuideId
      const unconsciousStep = guideId ? getGuide(guideId).unconsciousStep : undefined
      if (pendingGuideId && isCritical(signs)) {
        const stepIndex = signs.awake === false && unconsciousStep !== undefined ? unconsciousStep : 0
        effects.push({ type: "show-step", guideId: pendingGuideId, stepIndex })
        next.phase = "guiding"
        next.guideId = pendingGuideId
        next.pendingGuideId = undefined
        next.stepIndex = stepIndex
        return { state: next, effects }
      }
      if (signs.awake === false && state.guideId && unconsciousStep !== undefined && state.stepIndex !== unconsciousStep) {
        effects.push({ type: "show-step", guideId: state.guideId, stepIndex: unconsciousStep })
        next.phase = "guiding"
        next.stepIndex = unconsciousStep
      }
      return { state: next, effects }
    }
    case "handoff":
      return { state: { ...state, phase: "handoff" }, effects: [{ type: "say", text: handoffSummary(state), interruptible: false }] }
  }
}

const signText = (value: boolean | undefined, yes: string, no: string) =>
  value === undefined ? "chưa rõ" : value ? yes : no

/** Phiếu bàn giao cho nhân viên y tế, ghép tất định từ trạng thái (không qua LLM). */
export function handoffSummary(state: CallState, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - state.startedAt) / 60_000))
  const parts = [`Thông tin bàn giao cho nhân viên y tế. Cuộc gọi kéo dài khoảng ${minutes} phút.`]
  if (state.guideId) {
    const guide = getGuide(state.guideId)
    const reached = state.completedGuides.includes(state.guideId)
      ? "đã làm hết các bước"
      : `đã làm tới bước ${(state.stepIndex ?? 0) + 1} trên ${guide.steps.length}`
    parts.push(`Đã sơ cứu theo hướng dẫn ${guide.title}, ${guide.method.toLowerCase()}, ${reached}.`)
  } else {
    parts.push("Chưa thực hiện hướng dẫn sơ cứu nào.")
  }
  parts.push(
    `Tình trạng nạn nhân: ${signText(state.signs.awake, "còn tỉnh", "bất tỉnh")}, ${signText(state.signs.breathing, "còn thở", "không thở")}.`,
  )
  return parts.join(" ")
}

/** Tool LLM được phép gọi trong từng giai đoạn (tên khoá trong bộ tool của voice agent). */
export const PHASE_TOOLS: Record<CallPhase, string[]> = {
  triage: ["listFirstAidGuides", "proposeFirstAidGuide", "updateVictimSigns"],
  confirming: ["confirmFirstAidGuide", "rejectFirstAidGuide", "updateVictimSigns"],
  // Hướng dẫn linh hoạt: hỏi, nhảy bước, quay lại, đổi guide, ghi nhận dấu hiệu, bàn giao sớm.
  guiding: ["showFirstAidStep", "navigateFirstAidStep", "answerFromGuide", "updateVictimSigns", "handOff"],
  monitoring: ["showFirstAidStep", "navigateFirstAidStep", "answerFromGuide", "updateVictimSigns", "handOff"],
  handoff: ["showFirstAidStep", "answerFromGuide", "updateVictimSigns"],
}

/** Nguyên văn mọi bước của guide, để LLM trả lời câu hỏi dựa trên dữ liệu (kể cả bước trước/sau). */
function guideText(guideId: GuideId) {
  const guide = getGuide(guideId)
  // Đánh số dòng [n] để answerFromGuide trích đúng phần của bước chứa câu trả lời.
  return `Nội dung nguyên văn các bước của hướng dẫn "${guide.title}":\n${guide.steps
    .map((step, index) => {
      const lines = stepLines(step.text)
      const body = lines.length === 1 ? lines[0].text : lines.map((line, n) => `[${n + 1}] ${line.text}`).join(" ")
      return `Bước ${index + 1} "${step.title}": ${body}`
    })
    .join("\n")}`
}

/** Mô tả giai đoạn hiện tại cho LLM (thêm vào system prompt mỗi lượt). */
export function phaseBrief(state: CallState) {
  const signs = `Dấu hiệu nạn nhân đã biết: ${signText(state.signs.awake, "còn tỉnh", "bất tỉnh")}, ${signText(
    state.signs.breathing,
    "còn thở",
    "không thở",
  )}, ${signText(state.signs.talking, "nói/ho được", "không nói/ho được")}.`
  const guide = state.guideId ? getGuide(state.guideId) : undefined
  const step = guide && state.stepIndex !== undefined ? guide.steps[state.stepIndex] : undefined
  switch (state.phase) {
    case "triage":
      return `GIAI ĐOẠN HIỆN TẠI: PHÂN LOẠI (chưa mở hướng dẫn). Mục tiêu: hiểu chuyện gì xảy ra; khi đã khớp một hướng dẫn, dùng proposeFirstAidGuide để hỏi xác nhận bằng giọng nói. Trường hợp nguy kịch sẽ được hệ thống xử lý ngay. ${signs}`
    case "confirming": {
      const pendingGuide = state.pendingGuideId ? getGuide(state.pendingGuideId) : undefined
      return `GIAI ĐOẠN HIỆN TẠI: XÁC NHẬN tình huống cho hướng dẫn "${pendingGuide?.title}". Chỉ mở hướng dẫn khi người dùng xác nhận rõ ràng; gọi confirmFirstAidGuide khi họ nói đúng/đồng ý. Nếu họ nói không hoặc sửa lại tình huống, gọi rejectFirstAidGuide rồi chờ thêm thông tin, không tự tạo câu hỏi. Nếu có dấu hiệu nguy kịch mới, gọi updateVictimSigns ngay. ${signs}`
    }
    case "guiding":
      return `GIAI ĐOẠN HIỆN TẠI: HƯỚNG DẪN "${guide?.title}", đang ở bước ${(state.stepIndex ?? 0) + 1}/${guide?.steps.length} "${step?.title}". Linh hoạt theo người dùng: trả lời câu hỏi về bất kỳ bước nào, nhảy hoặc quay lại bước, đổi sang hướng dẫn khác nếu tình huống thay đổi. Câu hỏi về cách làm → answerFromGuide, chọn bước/dòng trong nội dung dưới đây. ${signs}
${guide ? guideText(guide.id) : ""}`
    case "monitoring":
      return `GIAI ĐOẠN HIỆN TẠI: THEO DÕI (đã làm xong hướng dẫn "${guide?.title}"). Ghi nhận thay đổi tình trạng nạn nhân mà người dùng vừa mô tả bằng updateVictimSigns. Khi người dùng báo đội cấp cứu đã tới, đã tới cơ sở y tế hoặc muốn kết thúc: gọi handOff. Câu hỏi về cách làm → answerFromGuide. ${signs}
${guide ? guideText(guide.id) : ""}`
    case "handoff":
      return `GIAI ĐOẠN HIỆN TẠI: BÀN GIAO (đã đọc thông tin bàn giao). Nội dung bàn giao đã được hệ thống đọc; không tạo câu trả lời tự do. Câu hỏi về cách làm → answerFromGuide. ${signs}
${guide ? guideText(guide.id) : ""}`
  }
}

/** Participant attributes agent đặt để giao diện hiển thị giai đoạn và phiếu bàn giao. */
export const CALL_ATTRIBUTE = { phase: "first-aid.phase", summary: "first-aid.summary" }
export const callPhaseSchema = z.enum(["triage", "confirming", "guiding", "monitoring", "handoff"])
