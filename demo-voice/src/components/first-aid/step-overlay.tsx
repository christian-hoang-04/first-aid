"use client"

import { useEffect, useRef, type Ref } from "react"
import gsap from "gsap"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

import type { FirstAidGuide } from "@/lib/first-aid/guides"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StepText } from "./step-text"

/** Bước hiện tại phủ trực tiếp lên cảnh 3D: nội dung nguyên văn từ dữ liệu, thanh tiến độ bấm được. */
export function StepOverlay({
  guide,
  stepIndex,
  substepIndex,
  onSelectStep,
  onClose,
  className,
  ref,
}: {
  guide: FirstAidGuide
  stepIndex: number
  substepIndex: number
  onSelectStep: (stepIndex: number) => void
  onClose: () => void
  className?: string
  ref?: Ref<HTMLElement>
}) {
  const stepRef = useRef<HTMLDivElement>(null)
  const step = guide.steps[stepIndex]

  useEffect(() => {
    if (!stepRef.current) return
    gsap.fromTo(
      stepRef.current.children,
      { opacity: 0, x: -16 },
      { opacity: 1, x: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", overwrite: true },
    )
  }, [guide.id, stepIndex])

  return (
    <section
      ref={ref}
      aria-label={`${guide.title} – ${guide.method}`}
      className={cn("flex flex-col gap-5 text-zinc-100 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]", className)}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-rose-400 uppercase">{guide.method}</p>
          <h1 className="text-base font-medium text-zinc-300">{guide.title}</h1>
        </div>
        <Button variant="ghost" size="icon-sm" className="rounded-full text-zinc-400" aria-label="Đóng hướng dẫn" onClick={onClose}>
          <XIcon />
        </Button>
      </header>

      <nav aria-label="Các bước" className="flex gap-1">
        {guide.steps.map((item, index) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Bước ${index + 1}: ${item.title}`}
            aria-current={index === stepIndex ? "step" : undefined}
            onClick={() => onSelectStep(index)}
            className="group flex h-6 flex-1 items-center outline-none"
          >
            <span
              className={cn(
                "h-1 w-full rounded-full transition-colors group-hover:bg-white/40 group-focus-visible:ring-2 group-focus-visible:ring-rose-500",
                index === stepIndex ? "bg-rose-500" : index < stepIndex ? "bg-rose-500/40" : "bg-white/15",
              )}
            />
          </button>
        ))}
      </nav>

      <div ref={stepRef} aria-live="polite" className="flex flex-col gap-3">
        <p className="text-sm text-zinc-400 tabular-nums">
          Bước {stepIndex + 1} / {guide.steps.length}
        </p>
        <h2 className="text-2xl leading-tight font-semibold text-balance sm:text-3xl">{step.title}</h2>
        <StepText text={step.text} className="text-base" />
        {step.substeps && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {step.substeps.map((substep, index) => (
              <span key={substep} className={cn("transition-colors", index === substepIndex ? "text-rose-300" : "text-zinc-500")}>
                {index + 1}. {substep}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Bước trước"
          disabled={stepIndex === 0}
          onClick={() => onSelectStep(stepIndex - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Bước tiếp"
          disabled={stepIndex === guide.steps.length - 1}
          onClick={() => onSelectStep(stepIndex + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </section>
  )
}
