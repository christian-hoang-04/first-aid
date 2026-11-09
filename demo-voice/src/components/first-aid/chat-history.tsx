"use client"

import type { ToolUIPart } from "ai"
import { BookOpenIcon, ListIcon } from "lucide-react"

import type { FirstAidUIMessage, FirstAidUITools } from "@/lib/first-aid/tools"
import { cn } from "@/lib/utils"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { StepText } from "./step-text"

type FirstAidToolPart = ToolUIPart<FirstAidUITools>

/** Lịch sử kênh chat (useChat): tin nhắn và client tool hiển thị bằng Trace, cuộn không hiện thanh cuộn. */
export function ChatHistory({ messages, className }: { messages: FirstAidUIMessage[]; className?: string }) {
  return (
    <section aria-label="Lịch sử trò chuyện" className={cn("flex min-h-0 flex-col text-zinc-100", className)}>
      {messages.length === 0 ? (
        <p className="p-6 text-sm text-zinc-500">Chưa có tin nhắn. Nói với trợ lý, hoặc bấm biểu tượng bàn phím để nhập.</p>
      ) : (
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport className="scrollbar-none">
              <MessageScrollerContent className="gap-5 p-6">
                {messages.map((message) => (
                  <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
                    <ChatMessage message={message} />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      )}
    </section>
  )
}

function ChatMessage({ message }: { message: FirstAidUIMessage }) {
  if (message.role === "user") {
    const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>{text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }
  return (
    <Message>
      <MessageContent className="gap-3">
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return part.text ? (
              <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-200">
                {part.text}
              </p>
            ) : null
          }
          if (part.type === "tool-listFirstAidGuides" || part.type === "tool-showFirstAidStep" || part.type === "tool-navigateFirstAidStep") {
            return <ToolPart key={part.toolCallId} part={part} />
          }
          return null
        })}
      </MessageContent>
    </Message>
  )
}

function ToolPart({ part }: { part: FirstAidToolPart }) {
  const isList = part.type === "tool-listFirstAidGuides"
  const icon = isList ? <ListIcon /> : <BookOpenIcon />

  if (part.state === "output-error") {
    return (
      <Trace>
        <TraceLine status="error">
          <TraceIcon>{icon}</TraceIcon>
          <TraceTitle>{isList ? "Không xem được danh sách hướng dẫn" : "Không mở được bước"}: {part.errorText}</TraceTitle>
        </TraceLine>
      </Trace>
    )
  }

  if (part.state !== "output-available") {
    return (
      <Trace>
        <TraceLine status="running">
          <TraceIcon>{icon}</TraceIcon>
          <TraceTitle>{isList ? "Đang xem danh sách hướng dẫn" : "Đang mở bước hướng dẫn"}</TraceTitle>
        </TraceLine>
      </Trace>
    )
  }

  if (part.type === "tool-listFirstAidGuides") {
    return (
      <Trace>
        <TraceCollapsible>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceIcon>{icon}</TraceIcon>
              <TraceTitle>Đã xem {part.output.guides.length} hướng dẫn</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <ul className="flex flex-col gap-1 text-sm">
              {part.output.guides.map((guide) => (
                <li key={guide.guideId}>
                  {guide.title} – {guide.method}
                </li>
              ))}
            </ul>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    )
  }

  const output = part.output
  if ("error" in output) {
    return (
      <Trace>
        <TraceLine status="error">
          <TraceIcon>{icon}</TraceIcon>
          <TraceTitle>{output.error}</TraceTitle>
        </TraceLine>
      </Trace>
    )
  }
  return (
    <Trace>
      <TraceCollapsible defaultOpen>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>{icon}</TraceIcon>
            <TraceTitle>
              Bước {output.step}/{output.totalSteps}: {output.title}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <p className="mb-1 text-xs text-zinc-500">{output.guideTitle}</p>
          <StepText text={output.text} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
