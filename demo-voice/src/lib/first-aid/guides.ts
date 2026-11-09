import { z } from "zod"

/**
 * Dữ liệu hướng dẫn sơ cứu. Nội dung `steps` chép nguyên văn từ mảng `STEPS` trong các file
 * `guides/*.html` để lời agent đọc khớp tuyệt đối với animation.
 */
export interface FirstAidStep {
  title: string
  /** Nội dung gốc; dòng bắt đầu bằng "– " là gạch đầu dòng. */
  text: string
  /** Các nấc nhỏ trong cùng một bước (animation chia nhiều đoạn). */
  substeps?: string[]
}

export interface FirstAidGuide {
  id: GuideId
  title: string
  method: string
  /** Khi nào dùng hướng dẫn này; giúp agent chọn đúng guide. */
  whenToUse: string
  /** File animation trong thư mục `guides/`. */
  file: string
  steps: FirstAidStep[]
  /** Bước (0-based) của chính guide này dành cho trường hợp nạn nhân bất tỉnh, nếu có. */
  unconsciousStep?: number
}

export const GUIDE_IDS = ["ep-bung", "gay-xuong-dui", "xuc-thia"] as const
export const guideIdSchema = z.enum(GUIDE_IDS)
export type GuideId = z.infer<typeof guideIdSchema>

export const FIRST_AID_GUIDES: FirstAidGuide[] = [
  {
    id: "ep-bung",
    title: "Sơ cứu hóc dị vật",
    method: "Phương pháp ép bụng",
    whenToUse: "Người lớn hoặc trẻ lớn bị hóc, nghẹn dị vật đường thở, không ho hoặc không nói được.",
    file: "ep-bung-3d.html",
    // Bước 7 của guide: "Nếu nạn nhân bất tỉnh: hồi sinh tim phổi…"
    unconsciousStep: 6,
    steps: [
      { title: "Tư thế nạn nhân", text: "Nạn nhân đứng đầu cúi thấp, miệng há ra." },
      { title: "Đứng phía sau nạn nhân", text: "Người sơ cấp cứu đứng phía sau nạn nhân luồn một chân vào giữa hai chân nạn nhân." },
      { title: "Đặt tay đúng vị trí", text: "Vòng hai tay phía trước bụng nạn nhân, một tay nắm đặt vào vị trí giữa rốn và mũi ức, tay kia bọc ra ngoài bàn tay trước." },
      { title: "Ép bụng", text: "Ép bụng đột ngột, tối đa một lần từ trước ra sau lên trên." },
      { title: "Đánh giá sau mỗi lần ép", text: "Đánh giá sự cải thiện tình trạng của nạn nhân sau mỗi lần ép." },
      { title: "Xen kẽ vỗ lưng và ép bụng", text: "Nếu dị vật chưa ra: xen kẽ phương pháp vỗ lưng và ép bụng cho đến khi dị vật bật ra." },
      { title: "Hồi sinh tim phổi", text: "Nếu nạn nhân bất tỉnh: hồi sinh tim phổi cho nạn nhân theo chu trình, bắt đầu bằng động tác ép ngực." },
      { title: "Chuyển tới cơ sở y tế", text: "Chuyển nạn nhân tới cơ sở y tế sau khi nạn nhân thở trở lại." },
    ],
  },
  {
    id: "gay-xuong-dui",
    title: "Cố định gãy xương đùi",
    method: "Phương pháp nẹp hai bên",
    whenToUse: "Nạn nhân nghi gãy xương đùi cần cố định chân bằng nẹp trước khi vận chuyển.",
    file: "gay-xuong-dui-3d.html",
    steps: [
      { title: "Chuẩn bị dụng cụ", text: "Chuẩn bị dụng cụ:\n– 2 nẹp;\n– 9 dây buộc;\n– Bông, vải, giấy mềm." },
      { title: "Động viên, giải thích", text: "Động viên, an ủi nạn nhân, người nhà và giải thích công việc sắp làm." },
      { title: "Nạn nhân nằm ngửa", text: "Nạn nhân nằm ngửa." },
      {
        title: "Luồn và rải dây",
        substeps: ["Luồn dây", "Rải dây"],
        text: "Luồn dây:\n– 2 dây qua eo lưng;\n– 5 dây qua khoeo chân;\n– 2 dây qua cổ chân.\nRải dây:\n– 2 dây: 1 dây ngang ngực, 1 dây ngang hông.\n– 5 dây: 1 dây sát bẹn, 2 dây trên và dưới ổ gãy, 2 dây ở đầu gối.\n– 2 dây ở cổ chân.",
      },
      { title: "Đặt nẹp", text: "Đặt nẹp:\n– 1 nẹp từ hõm nách đến quá cổ chân.\n– 1 nẹp từ nếp bẹn đến quá cổ chân." },
      { title: "Đệm lót", text: "Đệm lót bông, vải hoặc giấy mềm ở cổ chân, đầu gối, đầu nẹp." },
      {
        title: "Buộc dây cố định",
        text: "Buộc dây cố định nẹp theo thứ tự:\n– 1 dây trên ổ gãy, 1 dây dưới ổ gãy;\n– 1 dây dưới khớp gối;\n– 1 dây ngang hông;\n– 1 dây ngang ngực;\n– 1 dây sát bẹn;\n– 1 dây cổ chân;\n– 2 dây cố định chi lành và chi gãy ở cổ chân và đầu gối.",
      },
      { title: "Kiểm tra lưu thông máu", text: "Kiểm tra lưu thông máu của chân." },
      { title: "Chuyển đến cơ sở y tế", text: "Chuyển nạn nhân đến cơ sở y tế." },
    ],
  },
  {
    id: "xuc-thia",
    title: "Đưa nạn nhân lên cáng",
    method: "Phương pháp xúc thìa",
    whenToUse: "Cần nâng và chuyển nạn nhân (nghi chấn thương cột sống) lên cáng, có bốn người hỗ trợ.",
    file: "xuc-thia-3d.html",
    steps: [
      { title: "Chuẩn bị", text: "Chuẩn bị: cáng cứng, dây buộc, bốn người (trong đó có người chỉ huy)." },
      { title: "Đánh giá và sơ cứu", text: "Xác định tổn thương, sơ cấp cứu tổn thương nếu có." },
      { title: "Vào vị trí", text: "Một người giữ đầu, ba người quỳ một phía nạn nhân, luồn hai tay tại các vị trí: dưới vai và lưng, dưới thắt lưng và dưới đùi, dưới khoeo chân và dưới cổ chân." },
      {
        title: "Nâng theo ba nấc",
        substeps: ["Lên gối", "Úp vào người", "Đứng thẳng"],
        text: "Thực hiện theo hiệu lệnh đảm bảo nâng nạn nhân lên theo ba nấc: lên gối, úp nạn nhân vào người sơ cấp cứu và đứng thẳng. Đảm bảo đầu và cột sống nạn nhân luôn thẳng trong khi nâng lên, người giữ đầu nâng đầu nạn nhân thẳng với cột sống.",
      },
      { title: "Di chuyển đến cáng", text: "Người trưởng nhóm chỉ huy nhóm đồng loạt bước đi đưa nạn nhân đến vị trí cáng hoặc xe cứu thương." },
      { title: "Đặt xuống cáng", substeps: ["Xuống gối", "Xuống cáng"], text: "Đặt nạn nhân vào cáng theo hai bước ngược lại: xuống gối và xuống cáng." },
      { title: "Cố định nạn nhân", text: "Cố định nạn nhân vào cáng tại trán, cằm, vai, thắt lưng, đùi, cẳng chân, cổ chân." },
    ],
  },
]

export function getGuide(id: GuideId): FirstAidGuide {
  const guide = FIRST_AID_GUIDES.find((item) => item.id === id)
  if (!guide) throw new Error(`Không có hướng dẫn ${id}`)
  return guide
}

/** Tách nội dung bước thành các dòng hiển thị (bỏ ký hiệu gạch đầu dòng). */
export function stepLines(text: string) {
  return text.split("\n").map((line) => ({
    bullet: line.startsWith("– "),
    text: line.replace(/^– /, ""),
  }))
}

/**
 * Câu agent đọc cho một bước, ghép tất định từ dữ liệu gốc (không qua LLM) để tránh ảo giác.
 * Gạch đầu dòng được nối thành câu liền để TTS ngắt nghỉ tự nhiên.
 */
export function stepSpeech(guide: FirstAidGuide, index: number) {
  const step = guide.steps[index]
  const body = joinLines(stepLines(step.text).map((line) => line.text))
  return `Bước ${index + 1} trên ${guide.steps.length}: ${step.title}. ${body}.`
}

/** Nối các dòng thành một câu liền để TTS ngắt nghỉ tự nhiên. */
export function joinLines(lines: string[]) {
  return lines
    .map((line) => line.replace(/[;.]$/, ""))
    .reduce((speech, text) => (speech ? `${speech}${speech.endsWith(":") ? " " : ", "}${text}` : text), "")
}

/** Câu cố định khi vừa mở hướng dẫn: báo người dùng làm theo từng bước và cách chuyển bước. */
export function guideIntro(guide: FirstAidGuide) {
  return `Tôi sẽ hướng dẫn bạn ${guide.title.toLowerCase()} theo ${guide.method.toLowerCase()}, gồm ${guide.steps.length} bước. Bạn hãy làm theo hình trên màn hình, làm xong mỗi bước thì nói "xong" để sang bước tiếp theo.`
}

/** Trạng thái guide mà giao diện đang hiển thị, đồng bộ qua participant attributes. */
export const GUIDE_ATTRIBUTE = { guide: "first-aid.guide", step: "first-aid.step" }

/** RPC method giao diện đăng ký để agent điều khiển (client tool). */
export const SHOW_STEP_RPC = "first-aid.showStep"

export const showStepPayloadSchema = z.object({
  guideId: guideIdSchema,
  stepIndex: z.number().int().nonnegative(),
})
export type ShowStepPayload = z.infer<typeof showStepPayloadSchema>
