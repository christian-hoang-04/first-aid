"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

import type { GuideId } from "@/lib/first-aid/guides"
import { GUIDE_SCENES, createGuidePlayer, type GuidePlayer, type Insets } from "@/lib/first-aid/scenes"

/** Cảnh 3D của một hướng dẫn (three.js), tự phát animation khi `stepIndex` đổi. */
export function GuideScene({
  guideId,
  stepIndex,
  insets,
  onSubstepChange,
}: {
  guideId: GuideId
  stepIndex: number
  insets: Insets
  onSubstepChange?: (substepIndex: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<GuidePlayer | null>(null)
  const onSubstepChangeRef = useRef(onSubstepChange)

  useEffect(() => {
    onSubstepChangeRef.current = onSubstepChange
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const player = createGuidePlayer(container, GUIDE_SCENES[guideId], {
      onSubstepChange: (index) => onSubstepChangeRef.current?.(index),
    })
    playerRef.current = player
    const tween = gsap.fromTo(container, { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" })
    return () => {
      tween.kill()
      player.dispose()
      playerRef.current = null
    }
  }, [guideId])

  useEffect(() => {
    playerRef.current?.goStep(stepIndex)
  }, [guideId, stepIndex])

  const { top, right, bottom, left } = insets
  useEffect(() => {
    playerRef.current?.setInsets({ top, right, bottom, left })
  }, [guideId, top, right, bottom, left])

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
}
