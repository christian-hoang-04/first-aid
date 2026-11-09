"use client"

import { useEffect, useRef, useState, type FormEvent, type Ref } from "react"
import gsap from "gsap"
import {
  useAgent,
  useSessionContext,
  useSessionMessages,
  useTrackToggle,
  useTrackVolume,
  type AgentState,
} from "@livekit/components-react"
import { Track } from "livekit-client"
import { ArrowUpIcon, HistoryIcon, KeyboardIcon, MicOffIcon, PhoneIcon, PhoneOffIcon } from "lucide-react"

import { CALL_ATTRIBUTE, PHASE_LABEL, callPhaseSchema } from "@/lib/first-aid/call-state"
import { GREETING } from "@/lib/voice-events"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { VoiceOrb, type OrbMode } from "./voice-orb"
import { VoiceVisualizer } from "./voice-visualizer"

const STATE_LABEL: Record<AgentState, string> = {
  disconnected: "Chưa kết nối",
  connecting: "Đang kết nối…",
  "pre-connect-buffering": "Đang kết nối…",
  initializing: "Đang khởi động…",
  idle: "Đang chờ",
  listening: "Đang nghe",
  thinking: "Đang suy nghĩ…",
  speaking: "Đang nói",
  failed: "Lỗi kết nối",
}

function orbMode(state: AgentState): OrbMode {
  if (state === "listening" || state === "thinking" || state === "speaking") return state
  return "idle"
}

/**
 * Bảng điều khiển voice ở cạnh dưới: phụ đề, quả cầu (nút gọi / bật tắt micro) với visualizer hai
 * bên, và ô nhập chữ thu gọn cho kênh chat.
 */
export function VoiceConsole({
  chatCaption,
  chatBusy,
  historyOpen,
  onSendText,
  onToggleHistory,
  layout,
  className,
  ref,
}: {
  /** hero: giữa màn hình khi chưa mở guide; dock: thanh dưới khi đang hiển thị guide. */
  layout: "hero" | "dock"
  /** Câu trả lời mới nhất của kênh chat, hiển thị khi chưa gọi voice. */
  chatCaption?: string
  chatBusy: boolean
  historyOpen: boolean
  onSendText: (text: string) => void
  onToggleHistory: () => void
  className?: string
  ref?: Ref<HTMLDivElement>
}) {
  const session = useSessionContext()
  const agent = useAgent(session)
  const { messages } = useSessionMessages(session)
  const agentVolume = useTrackVolume(agent.microphoneTrack)
  const userVolume = useTrackVolume(session.local.microphoneTrack)
  const microphone = useTrackToggle({ source: Track.Source.Microphone, room: session.room })
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState("")
  const captionRef = useRef<HTMLParagraphElement>(null)

  // Giai đoạn cuộc gọi và phiếu bàn giao do worker đặt trên attributes của agent.
  const phase = callPhaseSchema.safeParse(agent.attributes[CALL_ATTRIBUTE.phase])
  const liveSummary = agent.attributes[CALL_ATTRIBUTE.summary]
  // Giữ phiếu bàn giao sau khi cúp máy để đưa nhân viên y tế xem; cuộc gọi mới đặt lại thành rỗng.
  const [handoffSummary, setHandoffSummary] = useState("")
  if (session.isConnected && liveSummary !== undefined && liveSummary !== handoffSummary) setHandoffSummary(liveSummary)

  const agentLine = messages.findLast((message) => message.type === "agentTranscript")?.message
  const userLine = messages.findLast((message) => message.type === "userTranscript")?.message
  const caption = session.isConnected ? (agentLine ?? GREETING) : chatCaption
  const speaking = agent.state === "speaking"
  const listening = session.isConnected && agent.state === "listening" && microphone.enabled
  const tone = speaking ? "agent" : listening ? "user" : "idle"
  const track = speaking ? agent.microphoneTrack : listening ? session.local.microphoneTrack : undefined
  const volume = speaking ? agentVolume : listening ? userVolume : 0

  useEffect(() => {
    if (captionRef.current) gsap.fromTo(captionRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" })
  }, [caption])

  const onOrbClick = () => {
    if (session.isConnected) microphone.toggle()
    else if (session.connectionState !== "connecting") session.start({ tracks: { microphone: { enabled: true } } })
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || chatBusy) return
    onSendText(text)
    setDraft("")
  }

  const hero = layout === "hero"
  const connecting = session.connectionState === "connecting"
  const showExtras = session.isConnected || chatCaption !== undefined

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center text-zinc-100",
        hero ? "gap-6 px-6" : "gap-3 bg-linear-to-t from-[#0d1015] from-40% via-[#0d1015]/80 to-transparent px-4 pt-20 pb-5",
        className,
      )}
    >
      {handoffSummary && (
        <section aria-label="Thông tin bàn giao" className="w-full max-w-xl border-l-2 border-rose-500 pl-4 text-left">
          <h2 className="text-xs font-semibold tracking-wider text-rose-400 uppercase">Thông tin bàn giao cho nhân viên y tế</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-200">{handoffSummary}</p>
        </section>
      )}
      <div aria-live="polite" className="flex max-w-2xl flex-col items-center gap-2 text-center">
        {caption ? (
          <p
            ref={captionRef}
            className={cn(
              "line-clamp-3 leading-snug font-medium text-balance text-zinc-50",
              hero ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl",
            )}
          >
            {caption}
          </p>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trợ lý sơ cứu</h1>
            <p className="max-w-md text-balance text-zinc-400">
              Bấm gọi và kể chuyện gì đang xảy ra. Trợ lý sẽ tự mở hướng dẫn phù hợp và đọc từng bước cho bạn.
            </p>
          </>
        )}
        {session.isConnected && userLine && <p className="line-clamp-1 text-sm text-cyan-200/80">Bạn: {userLine}</p>}
      </div>

      <div className={cn("flex items-center", hero ? "gap-4 sm:gap-8" : "gap-3 sm:gap-5")}>
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn("rounded-full text-zinc-400 hover:text-zinc-50", !showExtras && "invisible")}
          aria-label="Nhập bằng bàn phím"
          aria-pressed={typing}
          onClick={() => setTyping((value) => !value)}
        >
          <KeyboardIcon />
        </Button>
        <VoiceVisualizer track={track} tone={tone} bands={hero ? 9 : 7} mirror className="hidden sm:flex" />
        <button
          type="button"
          onClick={onOrbClick}
          aria-label={session.isConnected ? (microphone.enabled ? "Tắt micro" : "Bật micro") : "Gọi trợ lý sơ cứu"}
          className={cn(
            "relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rose-500",
            hero ? "size-40 sm:size-52" : "size-20 sm:size-24",
          )}
        >
          <VoiceOrb mode={orbMode(agent.state)} volume={volume} className="size-full" />
          {session.isConnected && !microphone.enabled && (
            <span className="absolute inset-0 flex items-center justify-center text-zinc-50">
              <MicOffIcon className="size-6" />
            </span>
          )}
        </button>
        <VoiceVisualizer track={track} tone={tone} bands={hero ? 9 : 7} className="hidden sm:flex" />
        <Button
          variant="ghost"
          size="icon-lg"
          className={cn("rounded-full text-zinc-400 hover:text-zinc-50", !showExtras && "invisible")}
          aria-label="Lịch sử trò chuyện"
          aria-pressed={historyOpen}
          onClick={onToggleHistory}
        >
          <HistoryIcon />
        </Button>
      </div>

      {session.isConnected ? (
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span>
            {STATE_LABEL[agent.state]}
            {phase.success && ` · ${PHASE_LABEL[phase.data]}`}
          </span>
          <Button variant="destructive" size="sm" className="rounded-full" onClick={() => session.end()}>
            <PhoneOffIcon />
            Kết thúc
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          disabled={connecting}
          onClick={onOrbClick}
          className={cn("rounded-full bg-rose-600 text-white hover:bg-rose-500", hero ? "h-12 px-6 text-base" : "px-4")}
        >
          <PhoneIcon />
          {connecting ? "Đang kết nối…" : agent.state === "failed" ? "Gọi lại" : "Gọi trợ lý"}
        </Button>
      )}

      {typing && (
        <form onSubmit={submit} className="w-full max-w-md">
          <InputGroup className="rounded-full border-white/10 bg-white/5">
            <InputGroupInput
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập câu hỏi…"
              aria-label="Tin nhắn"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={() => submit()} size="icon-xs" variant="default" aria-label="Gửi" className="rounded-full" disabled={!draft.trim() || chatBusy}>
                <ArrowUpIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      )}
    </div>
  )
}
