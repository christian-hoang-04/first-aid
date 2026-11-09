import { z } from "zod"

import { joinLines, stepLines, type FirstAidGuide } from "./guides"

/**
 * Trả lời câu hỏi kiểu trích xuất: LLM chỉ chọn bước/dòng chứa câu trả lời (hoặc báo hướng dẫn không
 * nói tới), còn câu nói được ghép tất định từ dữ liệu gốc. LLM không tự viết nội dung y tế.
 */

export const REASSURANCE_LINES = {
  none: "",
  calm: "Bạn bình tĩnh nhé.",
  "doing-well": "Bạn đang làm tốt lắm.",
}

export const NOT_COVERED_LINE = "Hướng dẫn không nói về điều này, bạn hãy hỏi tổng đài 115 nhé."
export const PARTLY_COVERED_LINE = "Phần còn lại hướng dẫn không nói tới, bạn hãy hỏi thêm tổng đài 115."

export const ANSWER_DESCRIPTION =
  "Trả lời câu hỏi của người dùng về cách sơ cứu bằng chính nội dung hướng dẫn đang mở; hệ thống tự đọc nguyên văn phần được chọn. " +
  "Trước hết xác định coverage (hướng dẫn trả lời câu hỏi tới đâu), rồi chọn đúng đoạn TRẢ LỜI TRỰC TIẾP câu hỏi."

export const answerInputSchema = z
  .object({
    coverage: z
      .enum(["full", "partial", "none"])
      .describe(
        '"full": hướng dẫn trả lời trực tiếp toàn bộ câu hỏi. "partial": trả lời được một phần, phần còn lại hướng dẫn không nói tới. ' +
          '"none": hướng dẫn không trả lời câu hỏi này (kể cả khi có bước nói về chủ đề gần giống nhưng là kỹ thuật/tình huống khác).',
      ),
    quotes: z
      .array(
        z
          .object({
            step: z.number().int().min(1).describe("Số thứ tự bước chứa câu trả lời, bắt đầu từ 1"),
            lines: z
              .array(z.number().int().min(1))
              .optional()
              .describe("Số thứ tự các dòng [n] trong bước chứa câu trả lời; bỏ trống để trích cả bước"),
          })
          .strict(),
      )
      .max(2)
      .describe('Chỉ những đoạn trả lời trực tiếp câu hỏi (thường 1). Rỗng khi coverage là "none".'),
    reassurance: z
      .enum(["none", "calm", "doing-well"])
      .describe('Câu trấn an cố định đọc trước câu trả lời: "calm" nếu người dùng hoảng hốt, "doing-well" để động viên, không thì "none"'),
  })
  .strict()
export type AnswerInput = z.infer<typeof answerInputSchema>

/** Dòng được chọn, kèm dòng tiêu đề gần nhất phía trên nếu dòng là gạch đầu dòng (giữ ngữ cảnh "Chuẩn bị dụng cụ: …"). */
function quotedLines(text: string, picked: number[] | undefined) {
  const lines = stepLines(text)
  if (!picked || picked.length === 0) return lines.map((line) => line.text)
  const indexes = new Set<number>()
  for (const number of picked) {
    const index = number - 1
    if (lines[index].bullet) {
      const header = lines.slice(0, index).findLastIndex((line) => !line.bullet)
      if (header !== -1) indexes.add(header)
    }
    indexes.add(index)
  }
  return [...indexes].sort((a, b) => a - b).map((index) => lines[index].text)
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/** Ghép câu trả lời từ dữ liệu gốc, hoặc trả lỗi để LLM chọn lại khi bước/dòng không tồn tại. */
export function composeAnswer(guide: FirstAidGuide, currentStep: number, input: AnswerInput): { speech: string } | { error: string } {
  if (input.coverage === "none" && input.quotes.length > 0) {
    return { error: 'coverage là "none" thì quotes phải rỗng: không trích đoạn không trả lời câu hỏi.' }
  }
  if (input.coverage !== "none" && input.quotes.length === 0) {
    return { error: `coverage là "${input.coverage}" thì cần ít nhất một đoạn trích trả lời câu hỏi.` }
  }
  const parts: string[] = []
  for (const quote of input.quotes) {
    const step = guide.steps[quote.step - 1]
    if (!step) return { error: `Hướng dẫn chỉ có ${guide.steps.length} bước.` }
    const lineCount = stepLines(step.text).length
    const badLine = quote.lines?.find((line) => line > lineCount)
    if (badLine !== undefined) return { error: `Bước ${quote.step} chỉ có ${lineCount} dòng.` }
    const body = joinLines(quotedLines(step.text, quote.lines))
    parts.push(
      quote.step - 1 === currentStep
        ? `Theo hướng dẫn, ${lowerFirst(body)}.`
        : `Ở bước ${quote.step}, hướng dẫn nói: ${body}.`,
    )
  }
  if (input.coverage === "partial") parts.push(PARTLY_COVERED_LINE)
  if (input.coverage === "none") parts.push(NOT_COVERED_LINE)
  const reassurance = REASSURANCE_LINES[input.reassurance]
  return { speech: [reassurance, ...parts].filter(Boolean).join(" ") }
}
