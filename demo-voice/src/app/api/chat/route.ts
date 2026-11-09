import { handleChatStream } from "@mastra/ai-sdk"
import { createUIMessageStreamResponse } from "ai"

import { mastra } from "@/mastra"

/** Kênh chat chữ: chat agent trả về stream cho useChat; tool chuyển bước chạy ở trình duyệt. */
export async function POST(req: Request) {
  const params = await req.json()
  const stream = await handleChatStream({
    mastra,
    agentId: "chatAgent",
    version: "v7",
    params,
  })
  return createUIMessageStreamResponse({ stream })
}
