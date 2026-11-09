import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

import { UP, V3, clamp, deg, ease, type Vec3 } from "./kit"

/** Một hướng nhìn cho mỗi keyframe: camera ở p nhìn về l; khoảng cách được căn tự động. */
export interface Shot {
  p: Vec3
  l: Vec3
}

/** Thời gian đã dừng ở keyframe hiện tại, cho các chuyển động lặp (ép bụng, ép ngực, buộc dây). */
export interface KeyClock {
  atTime: number
  lastKey: number
  lastTau: number
}

export interface SceneTag {
  label: string
  number?: number
  tone?: "warn" | "say" | "mini"
  groups: string[]
  position: () => THREE.Vector3
  /** Điều kiện hiển thị riêng thay cho `groups`. */
  visible?: (group: string | null) => boolean
}

export interface GuideSceneInstance {
  tags: SceneTag[]
  /** Đặt tư thế cho thời điểm t (keyframe thực), time là đồng hồ tuyệt đối (giây). */
  pose(t: number, time: number, clock: KeyClock): void
  tagGroup(t: number, hold: number): string | null
  /** Các điểm phải nằm trong khung hình ở từng keyframe. */
  focusPoints(): THREE.Vector3[][]
}

export interface GuideSceneDefinition {
  /** Keyframe đầu và cuối của từng bước. */
  ranges: [number, number][]
  /** Thời lượng đoạn i -> i+1 (giây). */
  segmentDurations: number[]
  /** Độ dài lời đọc gốc của từng bước; các đoạn trong bước giãn theo để giữ nhịp như bản gốc. */
  narrationDurations: number[]
  shots: Shot[]
  far: number
  build(scene: THREE.Scene): GuideSceneInstance
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface GuidePlayer {
  goStep(stepIndex: number): void
  resetView(): void
  setInsets(insets: Insets): void
  dispose(): void
}

const HOLD = 0.9
const FAST_SEGMENT = 0.55
const BACKGROUND = "#0d1015"
const FLOOR = "#1a2029"

const TAG_BASE =
  "pointer-events-none absolute top-0 left-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] leading-none font-semibold opacity-0 shadow-lg transition-opacity duration-300 will-change-transform max-sm:text-[11px]"
const TAG_TONE: Record<NonNullable<SceneTag["tone"]> | "default", string> = {
  default: "border-white/15 bg-zinc-900/90 text-zinc-100",
  warn: "border-rose-400/80 bg-zinc-900/90 text-rose-300",
  say: "border-amber-300/80 bg-amber-300 text-zinc-900",
  mini: "size-6 justify-center border-white/20 bg-zinc-900/90 p-0 text-[11px] text-zinc-100",
}

function createTagElement(tag: SceneTag) {
  const element = document.createElement("div")
  element.className = `${TAG_BASE} ${TAG_TONE[tag.tone ?? "default"]}`
  if (tag.number !== undefined) {
    const badge = document.createElement("span")
    badge.className = "flex size-[18px] items-center justify-center rounded-full bg-rose-500 text-[11px] font-extrabold text-white"
    badge.textContent = String(tag.number)
    element.append(badge)
  }
  element.append(tag.label)
  return element
}

/**
 * Dựng và chạy một cảnh guide trong `container`: tự phát animation khi chuyển bước, camera tự đổi
 * góc theo bước (người dùng kéo để xoay thì tạm tắt), nhãn 3D bám theo vật thể.
 */
export function createGuidePlayer(
  container: HTMLElement,
  definition: GuideSceneDefinition,
  { onSubstepChange }: { onSubstepChange?: (substepIndex: number) => void } = {},
): GuidePlayer {
  const { ranges, segmentDurations, shots } = definition
  const keyframes = shots.length
  const last = keyframes - 1

  const canvas = document.createElement("canvas")
  canvas.className = "absolute inset-0 block size-full touch-none outline-none"
  canvas.setAttribute("aria-hidden", "true")
  const tagLayer = document.createElement("div")
  tagLayer.className = "pointer-events-none absolute inset-0 overflow-hidden"
  tagLayer.setAttribute("aria-hidden", "true")
  container.append(canvas, tagLayer)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BACKGROUND)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, definition.far)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 1.5
  controls.maxDistance = 20
  controls.maxPolarAngle = Math.PI * 0.48
  controls.enablePan = false

  // Bản gốc dùng three.js 2021 (ánh sáng kiểu cũ); nhân π để giữ độ sáng với ánh sáng vật lý.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, 0.72 * Math.PI))
  const sun = new THREE.DirectionalLight(0xffffff, 0.78 * Math.PI)
  sun.position.set(2.5, 6, 4.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 })
  sun.shadow.bias = -0.0008
  scene.add(sun)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const guide = definition.build(scene)
  const tagElements = guide.tags.map((tag) => {
    const element = createTagElement(tag)
    tagLayer.append(element)
    return { tag, element, shown: false }
  })

  /* ---------------------------------------------------------------- playback */
  let t = 0
  let target = 0
  let hold = 0
  let fastUntil = -1
  let cur = 0
  let substep = -1
  const clock: KeyClock = { atTime: 0, lastKey: 0, lastTau: 0 }
  let atKey = -1
  let wasAt = false

  function goStep(n: number) {
    n = clamp(n, 0, ranges.length - 1)
    cur = n
    hold = 0
    camAuto = true
    const [a, b] = ranges[n]
    const start = Math.max(a - 1, 0)
    // Lùi về bước trước: nhảy thẳng tới đầu bước đó rồi phát tới, không tua ngược qua các bước giữa
    if (t > start + 1e-3) {
      t = start
      target = b
      fastUntil = -1
    } else {
      target = b
      fastUntil = start
    }
  }

  function segmentDuration(segment: number) {
    const [a, b] = ranges[cur]
    const base = segmentDurations[segment]
    if (segment + 1 < a || segment + 1 > b) return base
    const want = definition.narrationDurations[cur] / (b - a + 1) - HOLD
    return clamp(want, base, base * 1.8)
  }

  function tick(dt: number) {
    if (hold > 0) {
      hold -= dt
      return
    }
    if (Math.abs(target - t) < 1e-6) {
      t = target
      return
    }
    const dir = Math.sign(target - t)
    const fast = dir < 0 || t < fastUntil - 1e-6
    const segment = clamp(Math.floor(t + (dir > 0 ? 1e-6 : -1e-6)), 0, keyframes - 2)
    const speed = fast ? 1 / FAST_SEGMENT : 1 / segmentDuration(segment)
    let next = t + dir * speed * dt
    if (dir > 0 && !fast) {
      const nextInt = Math.floor(t + 1e-6) + 1
      if (next >= nextInt - 1e-6) {
        next = nextInt
        if (nextInt < target) hold = HOLD
      }
    } else if (dir > 0 && fast && next > fastUntil) {
      next = fastUntil
    }
    if ((dir > 0 && next > target) || (dir < 0 && next < target)) next = target
    t = next
  }

  function trackTime(dt: number) {
    const r = Math.round(t)
    if (Math.abs(t - r) < 1e-6) {
      if (!wasAt || r !== atKey) {
        atKey = r
        clock.atTime = 0
      } else clock.atTime += dt
      wasAt = true
      clock.lastKey = r
      clock.lastTau = clock.atTime
    } else wasAt = false
  }

  function emitSubstep() {
    const [a, b] = ranges[cur]
    const index = clamp(Math.round(t) - a, 0, b - a)
    if (index !== substep) {
      substep = index
      onSubstepChange?.(index)
    }
  }

  /* ---------------------------------------------------------------- tags */
  const projected = new V3()
  function placeTags() {
    const group = guide.tagGroup(t, hold)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    for (const item of tagElements) {
      const on = item.tag.visible ? item.tag.visible(group) : group !== null && item.tag.groups.includes(group)
      if (on) {
        projected.copy(item.tag.position()).project(camera)
        const visible = projected.z < 1 && projected.z > -1
        const x = (projected.x * 0.5 + 0.5) * w
        const y = (-projected.y * 0.5 + 0.5) * h
        item.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
        if (visible !== item.shown) {
          item.element.style.opacity = visible ? "1" : "0"
          item.shown = visible
        }
      } else if (item.shown) {
        item.element.style.opacity = "0"
        item.shown = false
      }
    }
  }

  /* ---------------------------------------------------------------- guided camera */
  const focus = guide.focusPoints()
  guide.pose(t, 0, clock)
  let camAuto = true
  let insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
  let viewOffX = 0
  let viewOffY = 0
  let wantX = 0
  let wantY = 0
  let freeW = 1
  let freeH = 1
  const camGoalP = new V3()
  const camGoalL = new V3()
  const fitP = [new V3(), new V3()]
  const fitL = [new V3(), new V3()]
  const _r = new V3()
  const _u = new V3()
  const _f = new V3()
  const _d = new V3()
  const _o = new V3()
  const _q = new V3()
  controls.addEventListener("start", () => {
    camAuto = false
  })

  /** Vùng trống của màn hình (trừ các panel phủ lên canvas). */
  function measureFree() {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    freeW = Math.max(80, w - insets.left - insets.right)
    freeH = Math.max(80, h - insets.top - insets.bottom)
    const cx = insets.left + freeW / 2
    const cy = insets.top + freeH / 2
    wantX = -(cx - w / 2)
    wantY = h / 2 - cy
  }

  function fitShot(k: number, outP: THREE.Vector3, outL: THREE.Vector3) {
    const shot = shots[k]
    const points = focus[k]
    _d.set(shot.p[0] - shot.l[0], shot.p[1] - shot.l[1], shot.p[2] - shot.l[2]).normalize()
    _f.copy(_d).negate()
    _r.crossVectors(_f, UP).normalize()
    _u.crossVectors(_r, _f).normalize()
    _o.set(0, 0, 0)
    points.forEach((p) => _o.add(p))
    _o.multiplyScalar(1 / points.length)
    let x0 = 1e9
    let x1 = -1e9
    let y0 = 1e9
    let y1 = -1e9
    points.forEach((p) => {
      _q.copy(p).sub(_o)
      const x = _q.dot(_r)
      const y = _q.dot(_u)
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    })
    outL.copy(_o).addScaledVector(_r, (x0 + x1) / 2).addScaledVector(_u, (y0 + y1) / 2)
    const h = canvas.clientHeight || 1
    const tanV = Math.tan((camera.fov * deg) / 2) * (freeH / h) * 0.86
    const tanH = Math.tan((camera.fov * deg) / 2) * (freeW / h) * 0.86
    let dist = 1.8
    points.forEach((p) => {
      _q.copy(p).sub(outL)
      const x = Math.abs(_q.dot(_r))
      const y = Math.abs(_q.dot(_u))
      const z = _q.dot(_d)
      dist = Math.max(dist, z + x / tanH, z + y / tanV)
    })
    outP.copy(outL).addScaledVector(_d, dist)
  }

  function shotAt(tt: number) {
    const i = clamp(Math.floor(tt), 0, keyframes - 2)
    const e = ease(clamp(tt - i, 0, 1))
    fitShot(i, fitP[0], fitL[0])
    fitShot(Math.min(i + 1, last), fitP[1], fitL[1])
    camGoalP.copy(fitP[0]).lerp(fitP[1], e)
    camGoalL.copy(fitL[0]).lerp(fitL[1], e)
  }

  function applyOffset() {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    camera.setViewOffset(w, h, viewOffX, viewOffY, w, h)
  }

  function updateCamera(dt: number) {
    measureFree()
    const kk = Math.min(1, dt * 6)
    viewOffX += (wantX - viewOffX) * kk
    viewOffY += (wantY - viewOffY) * kk
    applyOffset()
    if (!camAuto) return
    shotAt(target > t ? Math.min(t + 0.45, target) : t)
    const k = 1 - Math.exp(-dt * 2.6)
    camera.position.lerp(camGoalP, k)
    controls.target.lerp(camGoalL, k)
  }

  function snapView() {
    camAuto = true
    measureFree()
    viewOffX = wantX
    viewOffY = wantY
    applyOffset()
    shotAt(t)
    camera.position.copy(camGoalP)
    controls.target.copy(camGoalL)
    controls.update()
  }

  function resize() {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  snapView()

  let previous = performance.now()
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - previous) / 1000)
    previous = now
    tick(dt)
    trackTime(dt)
    guide.pose(t, now / 1000, clock)
    updateCamera(dt)
    controls.update()
    renderer.render(scene, camera)
    placeTags()
    emitSubstep()
  })

  return {
    goStep,
    resetView: () => {
      camAuto = true
    },
    setInsets: (next) => {
      insets = next
    },
    dispose: () => {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      controls.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
      canvas.remove()
      tagLayer.remove()
    },
  }
}
