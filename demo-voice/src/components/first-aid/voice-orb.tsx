"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import * as THREE from "three"

import { cn } from "@/lib/utils"

export type OrbMode = "idle" | "listening" | "thinking" | "speaking"

const MODE_COLORS: Record<OrbMode, [string, string]> = {
  idle: ["#c3cad6", "#4a5366"],
  listening: ["#5ee7ff", "#1463ff"],
  thinking: ["#d8b4fe", "#6d28d9"],
  speaking: ["#ff8a9b", "#c8102e"],
}

interface OrbUniforms {
  [uniform: string]: THREE.IUniform
  uTime: THREE.IUniform<number>
  uVolume: THREE.IUniform<number>
  uColorA: THREE.IUniform<THREE.Color>
  uColorB: THREE.IUniform<THREE.Color>
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uVolume;
  varying vec3 vNormal;
  varying float vWave;

  void main() {
    vec3 p = position;
    float wave = sin(p.x * 4.0 + uTime * 1.7) * sin(p.y * 3.5 + uTime * 1.3) * sin(p.z * 4.5 + uTime * 2.1);
    vWave = wave;
    vec3 displaced = p + normal * wave * (0.04 + uVolume * 0.32);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uVolume;
  varying vec3 vNormal;
  varying float vWave;

  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.2);
    vec3 color = mix(uColorB, uColorA, clamp(fresnel + vWave * 0.35 + uVolume * 0.4, 0.0, 1.0));
    gl_FragColor = vec4(color, 0.55 + fresnel * 0.45);
    // Đổi từ không gian màu tuyến tính về sRGB như các material có sẵn của three.js
    #include <colorspace_fragment>
  }
`

/** Quả cầu giọng nói: biến dạng theo âm lượng, đổi màu theo trạng thái agent. */
export function VoiceOrb({
  mode,
  volume,
  className,
}: {
  mode: OrbMode
  volume: number
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uniformsRef = useRef<OrbUniforms | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10)
    camera.position.z = 3.4

    const [colorA, colorB] = MODE_COLORS.idle
    const uniforms: OrbUniforms = {
      uTime: { value: 0 },
      uVolume: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
    }
    uniformsRef.current = uniforms

    const geometry = new THREE.IcosahedronGeometry(1, 48)
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const resize = () => {
      const size = Math.max(1, Math.min(container.clientWidth, container.clientHeight))
      renderer.setSize(size, size)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    const render = (time: number) => {
      uniforms.uTime.value = time
      mesh.rotation.y = time * 0.25
      renderer.render(scene, camera)
    }
    gsap.ticker.add(render)

    return () => {
      gsap.ticker.remove(render)
      observer.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      uniformsRef.current = null
    }
  }, [])

  useEffect(() => {
    const uniforms = uniformsRef.current
    if (!uniforms) return
    const [colorA, colorB] = MODE_COLORS[mode].map((hex) => new THREE.Color(hex))
    gsap.to(uniforms.uColorA.value, { r: colorA.r, g: colorA.g, b: colorA.b, duration: 0.6, overwrite: true })
    gsap.to(uniforms.uColorB.value, { r: colorB.r, g: colorB.g, b: colorB.b, duration: 0.6, overwrite: true })
  }, [mode])

  useEffect(() => {
    const uniforms = uniformsRef.current
    if (!uniforms) return
    gsap.to(uniforms.uVolume, { value: Math.min(1, volume * 2.5), duration: 0.18, overwrite: true })
  }, [volume])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn("flex items-center justify-center [&>canvas]:block", className)}
    />
  )
}
