"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { RoomAudioRenderer, SessionProvider, useSession } from "@livekit/components-react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { TokenSource } from "livekit-client"
import { XIcon } from "lucide-react"

import {
  GUIDE_ATTRIBUTE,
  SHOW_STEP_RPC,
  getGuide,
  showStepPayloadSchema,
  type GuideId,
} from "@/lib/first-aid/guides"
import {
  clampStep,
  navigateInputSchema,
  navigateTarget,
  showStepInputSchema,
  stepResult,
  type FirstAidUIMessage,
} from "@/lib/first-aid/tools"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChatHistory } from "./chat-history"
import { GuideScene } from "./guide-scene"
import { StepOverlay } from "./step-overlay"
import { VoiceConsole } from "./voice-console"

const tokenSource = TokenSource.endpoint("/api/livekit/token")
const chatTransport = new DefaultChatTransport<FirstAidUIMessage>({ api: "/api/chat" })

interface Selection {
  guideId: GuideId | null
  stepIndex: number
}

/** Kích thước phần tử (callback ref, vì có phần tử chỉ mount khi mở guide) để camera 3D tránh lớp phủ. */
function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, { width: number; height: number }] {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(() => setSize({ width: element.offsetWidth, height: element.offsetHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, element ? size : { width: 0, height: 0 }]
}

const latestChatText = (messages: FirstAidUIMessage[]) => {
  const reply = messages.findLast((message) => message.role === "assistant")
  const text = reply?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("").trim()
  return text || undefined
}

export function FirstAidAssistant() {
  const session = useSession(tokenSource)
  const [selection, setSelection] = useState<Selection>({ guideId: null, stepIndex: 0 })
  const [substepIndex, setSubstepIndex] = useState(0)
  const selectionRef = useRef(selection)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const [overlayRef, overlay] = useElementSize<HTMLElement>()
  const [consoleRef, consoleSize] = useElementSize<HTMLDivElement>()

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  const select = (guideId: GuideId | null, stepIndex = 0) => {
    setSelection({ guideId, stepIndex: guideId ? clampStep(guideId, stepIndex) : 0 })
    setSubstepIndex(0)
  }

  // Kênh chat: hai tool chuyển bước là client tool, chạy ngay tại đây rồi gửi kết quả về agent.
  const chat = useChat<FirstAidUIMessage>({
    transport: chatTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall({ toolCall }) {
      if (toolCall.dynamic) return
      if (toolCall.toolName === "showFirstAidStep") {
        const input = showStepInputSchema.safeParse(toolCall.input)
        if (!input.success) {
          chat.addToolOutput({ tool: "showFirstAidStep", toolCallId: toolCall.toolCallId, output: { error: "Tham số không hợp lệ" } })
          return
        }
        const stepIndex = clampStep(input.data.guideId, input.data.step - 1)
        select(input.data.guideId, stepIndex)
        chat.addToolOutput({ tool: "showFirstAidStep", toolCallId: toolCall.toolCallId, output: stepResult(input.data.guideId, stepIndex) })
      } else if (toolCall.toolName === "navigateFirstAidStep") {
        const input = navigateInputSchema.safeParse(toolCall.input)
        const { guideId, stepIndex } = selectionRef.current
        const target = input.success
          ? navigateTarget({ guideId: guideId ?? undefined, stepIndex }, input.data.direction)
          : { error: "Tham số không hợp lệ" }
        if ("error" in target) {
          chat.addToolOutput({ tool: "navigateFirstAidStep", toolCallId: toolCall.toolCallId, output: target })
          return
        }
        select(target.guideId, target.stepIndex)
        chat.addToolOutput({
          tool: "navigateFirstAidStep",
          toolCallId: toolCall.toolCallId,
          output: stepResult(target.guideId, target.stepIndex),
        })
      }
    },
  })

  // Kênh voice: client tool qua LiveKit RPC, agent trong worker gọi để chuyển bước.
  useEffect(() => {
    const room = session.room
    room.registerRpcMethod(SHOW_STEP_RPC, async ({ payload }) => {
      try {
        const parsed = showStepPayloadSchema.safeParse(JSON.parse(payload))
        if (!parsed.success) return JSON.stringify({ ok: false, error: "Payload không hợp lệ" })
        setSelection({ guideId: parsed.data.guideId, stepIndex: clampStep(parsed.data.guideId, parsed.data.stepIndex) })
        setSubstepIndex(0)
        return JSON.stringify({ ok: true })
      } catch {
        return JSON.stringify({ ok: false, error: "Payload không phải JSON" })
      }
    })
    return () => room.unregisterRpcMethod(SHOW_STEP_RPC)
  }, [session.room])

  // Đồng bộ bước đang hiển thị cho voice agent (đọc qua participant attributes).
  useEffect(() => {
    if (!session.isConnected) return
    session.room.localParticipant
      .setAttributes({
        [GUIDE_ATTRIBUTE.guide]: selection.guideId ?? "",
        [GUIDE_ATTRIBUTE.step]: String(selection.stepIndex),
      })
      .catch((error) => console.warn("Không cập nhật được attributes", error))
  }, [session.isConnected, session.room, selection.guideId, selection.stepIndex])

  const guide = selection.guideId ? getGuide(selection.guideId) : null
  // Overlay bước nằm bên trái khi màn hình đủ rộng, ngược lại nằm phía trên cảnh.
  const overlayBeside = overlay.width > 0 && overlay.width < stage.width * 0.6
  const insets = {
    top: overlayBeside ? 24 : overlay.height + 8,
    right: historyOpen ? Math.min(384, stage.width) + 16 : 24,
    bottom: Math.max(0, consoleSize.height - 56),
    left: overlayBeside ? overlay.width : 24,
  }

  return (
    <SessionProvider session={session}>
      <div ref={stageRef} className="dark relative h-dvh overflow-hidden bg-[#0d1015] text-zinc-100">
        {guide ? (
          <>
            <GuideScene guideId={guide.id} stepIndex={selection.stepIndex} insets={insets} onSubstepChange={setSubstepIndex} />
            <StepOverlay
              ref={overlayRef}
              guide={guide}
              stepIndex={selection.stepIndex}
              substepIndex={substepIndex}
              onSelectStep={(stepIndex) => select(guide.id, stepIndex)}
              onClose={() => select(null)}
              className="scrollbar-none absolute top-0 left-0 max-h-[45dvh] w-full overflow-y-auto bg-linear-to-b from-[#0d1015]/95 via-[#0d1015]/70 to-transparent p-5 pb-10 sm:max-h-none sm:max-w-md sm:bg-linear-to-r sm:p-8 sm:pr-16"
            />
          </>
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,16,46,0.16),transparent_60%)]" />
        )}

        <VoiceConsole
          ref={consoleRef}
          layout={guide ? "dock" : "hero"}
          chatCaption={latestChatText(chat.messages)}
          chatBusy={chat.status === "submitted" || chat.status === "streaming"}
          historyOpen={historyOpen}
          onSendText={(text) => chat.sendMessage({ text })}
          onToggleHistory={() => setHistoryOpen((open) => !open)}
          className={guide ? "absolute inset-x-0 bottom-0" : "absolute inset-0 justify-center"}
        />

        <aside
          aria-hidden={!historyOpen}
          inert={!historyOpen}
          className={cn(
            "absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-[#0d1015]/90 backdrop-blur-xl transition-transform duration-300 ease-out",
            historyOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-6 pt-5">
            <h2 className="text-sm font-medium text-zinc-400">Lịch sử trò chuyện</h2>
            <Button variant="ghost" size="icon-sm" className="rounded-full text-zinc-400" aria-label="Đóng lịch sử" onClick={() => setHistoryOpen(false)}>
              <XIcon />
            </Button>
          </div>
          <ChatHistory messages={chat.messages} className="flex-1" />
        </aside>
        <RoomAudioRenderer />
      </div>
    </SessionProvider>
  )
}
