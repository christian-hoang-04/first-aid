import * as THREE from "three"

import type { GuideSceneDefinition, KeyClock, SceneTag } from "./engine"
import { BASE_COLORS, UP, V3, clamp, createMaterials, deg, ease, lerp, type Vec3 } from "./kit"
import { PERSON_COLORS, Person, mixPose, offsetHands, resolvePose, type PersonPose, type PoseSpec } from "./person"

// Port từ guides/ep-bung-3d.html: sơ cứu hóc dị vật bằng phương pháp ép bụng.

type Cycle = "thrust" | "alt" | "cpr" | "breathe"
interface Keyframe {
  V: PoseSpec
  R: PoseSpec
  tags: string
  marker?: number
  arrow?: number
  ring?: number
  cycle?: Cycle
  alt?: { V: PoseSpec; R: PoseSpec }
}

const FIST: Vec3 = [0.0, 0.24, 0.15]
const COVER: Vec3 = [0.015, 0.24, 0.195]
const HUG: [Vec3, Vec3] = [COVER, FIST] // tay trái bọc ngoài nắm tay phải
const VSTAND = (lean: number, mouth = 1): PoseSpec => ({ p: [0, 0.95, 0], yaw: 0, lean, fx: [-0.08, 0.08], mouth })
const RBEHIND = (lean: number, hands: "rest" | [Vec3, Vec3]): PoseSpec => ({
  p: [0, 0.92, -0.33],
  yaw: 0,
  lean,
  fx: [-0.06, -0.095],
  fo: [-0.18, 0.33],
  hands,
  po: hands === "rest" ? 0 : 1,
})
const VLIE: PoseSpec = { p: [0, 0.12, 0], yaw: 90, lean: -90, L: 1 }

const K: Keyframe[] = [
  { V: VSTAND(40), R: { p: [-0.95, 0.95, -0.35], yaw: 70, lean: 0 }, tags: "k0" },
  { V: VSTAND(30), R: RBEHIND(8, "rest"), tags: "k1" },
  { V: VSTAND(30), R: RBEHIND(26, HUG), tags: "k2", marker: 1 },
  { V: VSTAND(30), R: RBEHIND(26, HUG), tags: "k3", arrow: 1, cycle: "thrust" },
  { V: VSTAND(30), R: RBEHIND(26, HUG), tags: "k4", ring: 1 },
  {
    V: VSTAND(30),
    R: RBEHIND(26, HUG),
    tags: "k5",
    cycle: "alt",
    alt: {
      V: VSTAND(55),
      R: { p: [-0.38, 0.95, -0.05], yaw: 45, lean: 25, fx: [-0.05, 0.05], fo: [0.05, -0.1], hands: [[0, 0.32, 0.17], [0, 0.4, -0.15]] },
    },
  },
  {
    V: { p: [-0.05, 0.16, 0], yaw: 90, lean: -30, L: 1 },
    R: { p: [-0.62, 0.48, 0], yaw: 90, lean: 15, k: 1, kb: 1, hands: [[-0.2, 0.36, -0.02], [0.2, 0.36, -0.02]] },
    tags: "faint",
  },
  { V: VLIE, R: { p: [-0.3, 0.5, -0.45], yaw: 0, lean: 10, k: 1, kb: 1 }, tags: "faint" },
  { V: VLIE, R: { p: [-0.3, 0.5, -0.42], yaw: 0, lean: 45, k: 1, kb: 1, hands: [[0, 0.3, 0.14], [0, 0.3, 0.19]] }, tags: "cpr", cycle: "cpr" },
  { V: VLIE, R: { p: [-0.3, 0.5, -0.5], yaw: 0, lean: 5, k: 1, kb: 1 }, tags: "breathe", cycle: "breathe" },
]

/** x: số giây kể từ lúc bắt đầu cú ép. */
function thrustPulse(x: number) {
  if (x < 0 || x > 0.5) return 0
  if (x < 0.1) return ease(x / 0.1)
  if (x < 0.2) return 1
  return 1 - ease((x - 0.2) / 0.3)
}

export const epBungScene: GuideSceneDefinition = {
  ranges: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 8], [9, 9]],
  segmentDurations: [2.6, 2.2, 1.6, 1.2, 0.8, 2.6, 2.6, 1.6, 2.0],
  narrationDurations: [2.53, 4.14, 5.88, 3.65, 3.58, 5.11, 5.01, 3.24],
  far: 80,
  shots: [
    { p: [1.6, 1.6, 2.6], l: [0, 1.1, 0] }, // 0 đầu cúi, miệng há, nhìn từ trước
    { p: [2.6, 0.9, 0.8], l: [0, 0.6, -0.1] }, // 1 thấp từ bên: người cứu đứng sau, chân giữa hai chân
    { p: [1.2, 1.4, 2.4], l: [0, 1.1, 0.1] }, // 2 phía trước: vị trí tay trên bụng
    { p: [3.0, 1.3, 0.2], l: [0, 1.1, -0.1] }, // 3 bên: hướng ép
    { p: [1.4, 1.7, 2.4], l: [0, 1.2, 0.1] }, // 4 phía trước: mặt nạn nhân để đánh giá
    { p: [2.6, 1.6, 1.6], l: [0, 1.1, 0] }, // 5 chéo: vỗ lưng và ép bụng
    { p: [1.8, 1.4, 2.6], l: [-0.3, 0.4, 0] }, // 6 nạn nhân được đỡ xuống sàn
    { p: [0.6, 2.0, 2.8], l: [-0.2, 0.3, 0] }, // 7 nạn nhân nằm ngửa, người cứu cạnh ngực
    { p: [1.6, 1.4, 2.4], l: [-0.3, 0.4, -0.1] }, // 8 ép ngực
    { p: [0.8, 2.2, 3.0], l: [-0.2, 0.3, 0] }, // 9 thở trở lại
  ],

  build(scene) {
    const m = createMaterials(PERSON_COLORS)
    const victim = new Person("victim", m)
    const rescuer = new Person("rescuer", m)
    const people = [rescuer, victim]
    people.forEach((person) => scene.add(person.root))
    const toVictim = (local: THREE.Vector3) => victim.torso.localToWorld(local)
    const resolve = (spec: PoseSpec) => resolvePose(spec, toVictim)

    /* markers trên người nạn nhân */
    const markMat = new THREE.MeshBasicMaterial({ color: BASE_COLORS.red, transparent: true, opacity: 0, depthWrite: false })
    // điểm giữa rốn và mũi ức (bước 3)
    const marker = new THREE.Group()
    marker.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 48), markMat))
    marker.position.set(0, 0.24, 0.13)
    victim.torso.add(marker)
    // hướng ép: vào trong và lên trên (bước 4)
    const arrowMat = new THREE.MeshBasicMaterial({ color: BASE_COLORS.red, transparent: true, opacity: 0 })
    const arrow = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.2, 12), arrowMat)
    shaft.position.y = 0.1
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 16), arrowMat)
    tip.position.y = 0.235
    arrow.add(shaft, tip)
    arrow.position.set(0.27, 0.17, 0.3)
    arrow.quaternion.setFromUnitVectors(UP, new V3(0, 0.55, -0.83).normalize())
    victim.torso.add(arrow)
    // vòng quanh đầu khi đánh giá (bước 5)
    const ringMat = new THREE.MeshBasicMaterial({ color: BASE_COLORS.red, transparent: true, opacity: 0, depthWrite: false })
    const headRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 8, 64), ringMat)
    headRing.rotation.x = Math.PI / 2
    headRing.position.set(0, 0.67, 0.015)
    victim.torso.add(headRing)

    /* chuyển động lặp */
    let pulse = 0
    let altPhase: "thrust" | "blows" = "thrust"
    const applyThrust = (V: PersonPose, R: PersonPose, p: number) => {
      offsetHands(R, [0, 1], () => new V3(0, 0.055, -0.075).multiplyScalar(p).applyQuaternion(victim.torso.quaternion))
      V.lean += 4 * deg * p
      R.lean -= 3 * deg * p
    }
    function cycleState(i: number, tau: number, V: PersonPose, R: PersonPose): [PersonPose, PersonPose] {
      const keyframe = K[i]
      if (keyframe.cycle === "thrust") {
        const p = thrustPulse((tau % 3.0) - 0.7)
        applyThrust(V, R, p)
        pulse = p
      } else if (keyframe.cycle === "alt" && keyframe.alt) {
        const ph = tau % 5.6
        const w = ph < 0.7 ? ease(ph / 0.7) : ph < 2.8 ? 1 : ph < 3.5 ? 1 - ease((ph - 2.8) / 0.7) : 0
        V = mixPose(V, resolve(keyframe.alt.V), w)
        R = mixPose(R, resolve(keyframe.alt.R), w)
        altPhase = w > 0.5 ? "blows" : "thrust"
        if (ph >= 0.7 && ph < 2.8) {
          // ba cú vỗ lưng
          const x = ((ph - 0.7) % 0.7) / 0.7
          const s = x < 0.6 ? 1 - ease(x / 0.6) : ease((x - 0.6) / 0.4)
          const away = (1 - s) * w
          offsetHands(R, [1], () => new V3(0, 0.09, -0.2).multiplyScalar(away).applyQuaternion(victim.torso.quaternion))
          V.lean += (3 * deg * Math.max(0, s - 0.85)) / 0.15
        }
        if (ph >= 3.5) {
          // hai cú ép bụng
          applyThrust(V, R, thrustPulse(((ph - 3.5) % 1.05) - 0.25))
        }
      } else if (keyframe.cycle === "cpr") {
        const x = (tau % 0.55) / 0.55
        const p = Math.pow(Math.sin(x * Math.PI), 2)
        R.p.y -= 0.045 * p
        R.lean += 2 * deg * p
        V.chest = 1 - 0.13 * p
        offsetHands(R, [0, 1], () => new V3(0, -0.035 * p, 0))
      } else if (keyframe.cycle === "breathe") {
        V.chest = 1 + 0.09 * (0.5 - 0.5 * Math.cos((tau * 2 * Math.PI) / 3.6))
      }
      return [V, R]
    }
    function stateAt(i: number, tau: number): [PersonPose, PersonPose] {
      const V = resolve(K[i].V)
      const R = resolve(K[i].R)
      return K[i].cycle ? cycleState(i, tau, V, R) : [V, R]
    }

    function pose(t: number, time: number, clock: KeyClock) {
      const i = clamp(Math.floor(t), 0, K.length - 2)
      const fr = clamp(t - i, 0, 1)
      const e = ease(fr)
      pulse = 0
      let V: PersonPose
      let R: PersonPose
      if (fr < 1e-6) [V, R] = stateAt(i, clock.atTime)
      else if (fr > 1 - 1e-6) [V, R] = stateAt(i + 1, clock.atTime)
      else {
        const [Va, Ra] = stateAt(i, clock.lastKey === i ? clock.lastTau : 0)
        const [Vb, Rb] = stateAt(i + 1, clock.lastKey === i + 1 ? clock.lastTau : 0)
        V = mixPose(Va, Vb, e)
        R = mixPose(Ra, Rb, e)
      }
      victim.frame(V)
      victim.torso.updateMatrixWorld(true)
      rescuer.frame(R)
      const a = K[i]
      const b = K[i + 1]
      const weight = (key: "marker" | "arrow" | "ring") =>
        lerp(a[key] ?? 0, b[key] ?? 0, fr < 1e-6 ? 0 : fr > 1 - 1e-6 ? 1 : e)
      markMat.opacity = weight("marker") * (0.6 + 0.3 * Math.sin(time * 4))
      marker.visible = markMat.opacity > 0.01
      arrowMat.opacity = weight("arrow") * 0.92
      arrow.visible = arrowMat.opacity > 0.01
      arrow.scale.setScalar(1 + 0.25 * pulse)
      ringMat.opacity = weight("ring") * (0.55 + 0.35 * Math.sin(time * 4))
      headRing.visible = ringMat.opacity > 0.01
    }

    const groupOf = (k: number) => (K[k].tags === "k5" ? `k5-${altPhase}` : K[k].tags)

    /* nhãn */
    const vL = (x: number, y: number, z: number) => () => victim.torso.localToWorld(new V3(x, y, z))
    const above = (person: Person, y: number) => () => person.headW.clone().add(new V3(0, y, 0))
    const tags: SceneTag[] = [
      { label: "Đầu cúi thấp", groups: ["k0"], position: above(victim, 0.3) },
      { label: "Miệng há ra", groups: ["k0"], position: vL(0, 0.56, 0.32) },
      { label: "Đứng phía sau", groups: ["k1"], position: above(rescuer, 0.3) },
      { label: "Một chân ở giữa", groups: ["k1"], position: () => rescuer.foot[1].position.clone().add(new V3(0.05, 0.3, 0.1)) },
      { label: "Giữa rốn và mũi ức", number: 1, groups: ["k2"], position: vL(0, 0.3, 0.42) },
      { label: "Tay nắm, tay bọc ngoài", number: 2, groups: ["k2"], position: vL(0.34, 0.02, 0.3) },
      { label: "Vào trong, lên trên", groups: ["k3"], position: () => arrow.localToWorld(new V3(0, 0.3, 0)) },
      { label: "Đánh giá tình trạng", tone: "warn", groups: ["k4"], position: above(victim, 0.32) },
      { label: "Vỗ lưng", groups: ["k5-blows"], position: vL(0, 0.55, -0.4) },
      { label: "Ép bụng", groups: ["k5-thrust"], position: vL(0.05, 0.24, 0.45) },
      { label: "Nạn nhân bất tỉnh", tone: "warn", groups: ["faint"], position: above(victim, 0.35) },
      { label: "Ép ngực", groups: ["cpr"], position: above(rescuer, 0.3) },
      { label: "Thở trở lại", groups: ["breathe"], position: vL(0, 0.3, 0.38) },
      { label: "Chuyển tới cơ sở y tế", groups: ["breathe"], position: vL(0, 0.95, 0.4) },
    ]

    return {
      tags,
      pose,
      tagGroup(t) {
        const r = Math.round(t)
        return Math.abs(t - r) >= 0.18 ? null : groupOf(r)
      },
      focusPoints() {
        const grab = (k: number, tau: number) => {
          pose(k, 0, { atTime: tau, lastKey: k, lastTau: tau })
          const points: THREE.Vector3[] = []
          people.forEach((person) => {
            points.push(person.headW.clone().add(new V3(0, 0.32, 0)))
            person.foot.forEach((foot) => points.push(foot.position.clone()))
            person.hand.forEach((hand) => points.push(hand.position.clone()))
          })
          const group = groupOf(k)
          tags.forEach((tag) => {
            if (tag.groups.includes(group)) points.push(tag.position().add(new V3(0, 0.12, 0)))
          })
          return points
        }
        const focus = K.map((keyframe, k) => (keyframe.cycle === "alt" ? [...grab(k, 0), ...grab(k, 1.7)] : grab(k, 0)))
        altPhase = "thrust"
        people.forEach((person) => person.resetMotion())
        return focus
      },
    }
  },
}
