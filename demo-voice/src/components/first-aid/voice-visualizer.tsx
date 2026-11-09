"use client"

import { useMultibandTrackVolume, type TrackReference } from "@livekit/components-react"

import { cn } from "@/lib/utils"

/**
 * Thanh tần số của track đang phát âm thanh. `mirror` đảo thứ tự để đặt đối xứng hai bên quả cầu
 * (tần số thấp nằm sát quả cầu).
 */
export function VoiceVisualizer({
  track,
  tone,
  bands = 7,
  mirror = false,
  className,
}: {
  track?: TrackReference
  tone: "agent" | "user" | "idle"
  bands?: number
  mirror?: boolean
  className?: string
}) {
  const volumes = useMultibandTrackVolume(track, { bands, loPass: 80, hiPass: 300 })
  const levels = Array.from({ length: bands }, (_, i) => (tone === "idle" ? 0 : (volumes[i] ?? 0)))
  const ordered = mirror ? [...levels].reverse() : levels

  return (
    <div aria-hidden="true" className={cn("flex h-12 items-center gap-1", className)}>
      {ordered.map((level, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(12, Math.min(100, level * 260))}%` }}
          className={cn(
            "w-1.5 rounded-full transition-[height,background-color] duration-100 ease-out",
            tone === "agent" && "bg-rose-400",
            tone === "user" && "bg-cyan-300",
            tone === "idle" && "bg-white/15",
          )}
        />
      ))}
    </div>
  )
}
