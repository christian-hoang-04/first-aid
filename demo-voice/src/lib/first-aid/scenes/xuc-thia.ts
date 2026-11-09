import * as THREE from "three"

import type { GuideSceneDefinition, SceneTag } from "./engine"
import { BASE_COLORS, V3, clamp, createMaterials, deg, ease, lerp, shadowAll, type Vec3 } from "./kit"
import { PERSON_COLORS, Person, mixPose, resolvePose, type PoseSpec } from "./person"

// Port từ guides/xuc-thia-3d.html: đưa nạn nhân lên cáng bằng phương pháp xúc thìa.

interface Keyframe {
  /** Nạn nhân: x, y, z, góc lăn quanh trục X (độ). */
  v: [number, number, number, number]
  H: PoseSpec
  R: [PoseSpec, PoseSpec, PoseSpec]
  rings: number
  straps: number
  tags: string
}

const D = 1.6 // khoảng cách tới cáng
const RX = [-0.37, 0.09, 0.65]
const SUP: [Vec3, Vec3][] = [
  [[-0.46, -0.1, -0.12], [-0.26, -0.1, -0.12]],
  [[-0.06, -0.1, -0.12], [0.24, -0.08, -0.1]],
  [[0.46, -0.06, -0.1], [0.84, -0.06, -0.1]],
]
const HOLD_HEAD: [Vec3, Vec3] = [[-0.73, 0.0, 0.125], [-0.73, 0.0, -0.125]]
const P = (x: number, y: number, z: number, yaw: number, lean: number, k: number, hands: PoseSpec["hands"]): PoseSpec => ({
  p: [x, y, z],
  yaw,
  lean,
  k,
  hands,
})
const team = (y: number, z: number, lean: number, k: number, dz = 0): Keyframe["R"] => [
  P(RX[0], y, z + dz, 0, lean, k, SUP[0]),
  P(RX[1], y, z + dz, 0, lean, k, SUP[1]),
  P(RX[2], y, z + dz, 0, lean, k, SUP[2]),
]
const standing = (z: number, [x0, x1, x2]: number[] = [-0.55, 0.1, 0.75]): Keyframe["R"] => [
  P(x0, 0.95, z, 0, 0, 0, "rest"),
  P(x1, 0.95, z, 0, 0, 0, "rest"),
  P(x2, 0.95, z, 0, 0, 0, "rest"),
]

const K: Keyframe[] = [
  { v: [0, 0.11, 0, 0], H: P(-1.2, 0.95, -1.15, 0, 0, 0, "rest"), R: standing(-1.15), rings: 0, straps: 0, tags: "prep" },
  { v: [0, 0.11, 0, 0], H: P(-1.42, 0.44, 0, 90, 58, 1, HOLD_HEAD), R: standing(-1.15), rings: 1, straps: 0, tags: "assess" },
  { v: [0, 0.11, 0, 0], H: P(-1.42, 0.44, 0, 90, 58, 1, HOLD_HEAD), R: team(0.42, -0.68, 66, 1), rings: 0, straps: 0, tags: "pos" },
  { v: [0, 0.66, -0.3, 0], H: P(-1.4, 0.46, -0.3, 90, 25, 1, HOLD_HEAD), R: team(0.47, -0.68, 18, 1), rings: 0, straps: 0, tags: "lift" },
  { v: [0, 0.88, -0.44, -80], H: P(-1.36, 0.48, -0.44, 90, 8, 1, HOLD_HEAD), R: team(0.48, -0.68, 0, 1), rings: 0, straps: 0, tags: "lift" },
  { v: [0, 1.33, -0.44, -80], H: P(-1.3, 0.95, -0.44, 90, 8, 0, HOLD_HEAD), R: team(0.95, -0.68, 0, 0), rings: 0, straps: 0, tags: "lift" },
  { v: [0, 1.33, -0.44 + D, -80], H: P(-1.3, 0.95, -0.44 + D, 90, 8, 0, HOLD_HEAD), R: team(0.95, -0.68, 0, 0, D), rings: 0, straps: 0, tags: "walk" },
  { v: [0, 0.66, -0.3 + D, 0], H: P(-1.4, 0.46, -0.3 + D, 90, 25, 1, HOLD_HEAD), R: team(0.47, -0.68, 18, 1, D), rings: 0, straps: 0, tags: "lower" },
  { v: [0, 0.18, D, 0], H: P(-1.42, 0.44, D, 90, 58, 1, HOLD_HEAD), R: team(0.42, -0.68, 66, 1, D), rings: 0, straps: 0, tags: "lower" },
  { v: [0, 0.18, D, 0], H: P(-1.78, 0.95, D, 90, 0, 0, "rest"), R: standing(D - 1.08, RX), rings: 0, straps: 1, tags: "straps" },
]

const STRAPS = [
  { x: -0.79, top: 0.11, hw: 0.12, name: "Trán" },
  { x: -0.63, top: 0.09, hw: 0.11, name: "Cằm" },
  { x: -0.42, top: 0.115, hw: 0.29, name: "Vai" },
  { x: -0.06, top: 0.115, hw: 0.29, name: "Thắt lưng" },
  { x: 0.24, top: 0.04, hw: 0.18, name: "Đùi" },
  { x: 0.6, top: 0.035, hw: 0.18, name: "Cẳng chân" },
  { x: 0.84, top: 0.035, hw: 0.18, name: "Cổ chân" },
]
const BOARD_TOP_LOCAL = 0.065 - 0.18

/** Những gì phải nằm trong khung hình ở mỗi keyframe. */
const FOCUS: { who: "all" | "leader" | "none"; stretcher?: boolean; ground?: boolean; rings?: boolean; strapTags?: boolean }[] = [
  { who: "all", stretcher: true, ground: true },
  { who: "leader", rings: true },
  { who: "all" },
  { who: "all" },
  { who: "all" },
  { who: "all" },
  { who: "all", stretcher: true },
  { who: "all", stretcher: true },
  { who: "all", stretcher: true },
  { who: "none", stretcher: true, strapTags: true },
]

function buildVictim(m: (key: "vic" | "vicP" | "vicD" | "shoe" | "skin" | "hair") => THREE.Material) {
  const victim = new THREE.Group()
  const body = new THREE.Group()
  victim.add(body)
  const torsoGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 24)
  torsoGeometry.scale(0.11, 1, 0.18)
  torsoGeometry.rotateZ(Math.PI / 2)
  const torso = new THREE.Mesh(torsoGeometry, m("vic"))
  torso.position.x = -0.25
  body.add(torso)
  const shoulderGeometry = new THREE.SphereGeometry(1, 24, 16)
  shoulderGeometry.scale(0.09, 0.11, 0.18)
  const shoulders = new THREE.Mesh(shoulderGeometry, m("vic"))
  shoulders.position.x = -0.5
  body.add(shoulders)
  const hipGeometry = new THREE.SphereGeometry(1, 24, 16)
  hipGeometry.scale(0.11, 0.1, 0.17)
  const hips = new THREE.Mesh(hipGeometry, m("vicP"))
  hips.position.x = 0.02
  body.add(hips)
  for (const z of [-0.092, 0.092]) {
    const legGeometry = new THREE.CylinderGeometry(0.068, 0.06, 0.86, 16)
    legGeometry.rotateZ(Math.PI / 2)
    const leg = new THREE.Mesh(legGeometry, m("vicP"))
    leg.position.set(0.45, -0.035, z)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.1), m("shoe"))
    foot.position.set(0.9, 0.01, z)
    body.add(leg, foot)
  }
  for (const z of [-0.235, 0.235]) {
    const armGeometry = new THREE.CylinderGeometry(0.046, 0.04, 0.56, 14)
    armGeometry.rotateZ(Math.PI / 2)
    const arm = new THREE.Mesh(armGeometry, m("vicD"))
    arm.position.set(-0.2, -0.015, z)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), m("skin"))
    hand.position.set(0.11, -0.02, z)
    body.add(arm, hand)
  }
  const neckGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 14)
  neckGeometry.rotateZ(Math.PI / 2)
  const neck = new THREE.Mesh(neckGeometry, m("skin"))
  neck.position.set(-0.57, 0.0, 0)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), m("skin"))
  head.position.set(-0.72, 0.02, 0)
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112, 24, 18), m("hair"))
  hair.position.set(-0.738, 0.0, 0)
  hair.scale.set(1, 0.92, 1)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), m("skin"))
  nose.position.set(-0.7, 0.132, 0)
  body.add(neck, head, hair, nose)
  shadowAll(body)
  return victim
}

export const xucThiaScene: GuideSceneDefinition = {
  ranges: [[0, 0], [1, 1], [2, 2], [3, 5], [6, 6], [7, 8], [9, 9]],
  segmentDurations: [2.2, 2.2, 2.2, 2.2, 2.2, 3.4, 2.4, 2.2, 3.2],
  narrationDurations: [3.68, 2.88, 7.94, 11.44, 5.1, 4.01, 4.55],
  far: 60,
  shots: [
    { p: [2.6, 2.5, 5.0], l: [-0.2, 0.45, 0.55] }, // 0 chuẩn bị: cả nhóm, nạn nhân, cáng, dây
    { p: [0.6, 2.0, 2.7], l: [-0.15, 0.15, 0.0] }, // 1 đánh giá: cận nạn nhân và các vòng kiểm tra
    { p: [1.9, 1.75, 2.2], l: [-0.2, 0.3, -0.3] }, // 2 vào vị trí: dọc hàng người, tay luồn dưới nạn nhân
    { p: [0.9, 1.15, 2.7], l: [-0.2, 0.5, -0.4] }, // 3 lên gối
    { p: [2.5, 1.3, 0.9], l: [-0.2, 0.75, -0.45] }, // 4 úp vào người: từ phía chân
    { p: [0.9, 1.45, 3.7], l: [-0.25, 0.9, -0.5] }, // 5 đứng thẳng: cả nhóm
    { p: [3.4, 1.9, 2.7], l: [-0.2, 0.6, 0.9] }, // 6 di chuyển: từ bên hông
    { p: [1.4, 1.15, 4.0], l: [-0.2, 0.45, 1.2] }, // 7 xuống gối: thấp, trước cáng
    { p: [0.8, 2.0, 4.0], l: [-0.1, 0.2, 1.45] }, // 8 xuống cáng
    { p: [0.3, 2.7, 3.5], l: [0.0, 0.1, 1.6] }, // 9 cố định: từ trên, đủ bảy dây
  ],

  build(scene) {
    const m = createMaterials({ ...PERSON_COLORS, board: 0xe8762d, boardD: 0xb9541a, strap: 0x1f2328, buckle: 0xb4bcc6 })
    const victim = buildVictim(m)
    scene.add(victim)
    const toVictim = (local: THREE.Vector3) => victim.localToWorld(local)

    // vòng kiểm tra ở bước 2 (con của nạn nhân)
    const ringMat = new THREE.MeshBasicMaterial({ color: BASE_COLORS.red, transparent: true, opacity: 0, depthWrite: false })
    const rings = [[-0.72, 0.17], [-0.26, 0.31], [0.52, 0.33]].map(([x, r]) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 64), ringMat)
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(x, 0.16, 0)
      victim.add(mesh)
      return mesh
    })

    // cáng và dây
    const stretcher = new THREE.Group()
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.05, 0.46), m("board"))
    board.position.y = 0.04
    stretcher.add(board)
    for (let i = 0; i < 7; i++) {
      for (const z of [-0.19, 0.19]) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.006, 0.045), m("boardD"))
        slot.position.set(-0.84 + i * 0.28, 0.066, z)
        stretcher.add(slot)
      }
    }
    stretcher.position.set(0.05, 0, D)
    scene.add(shadowAll(stretcher))

    const wrapStraps = STRAPS.map((strap) => {
      const group = new THREE.Group()
      const h = strap.top - BOARD_TOP_LOCAL
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, strap.hw * 2 + 0.02), m("strap"))
      top.position.set(0, strap.top + 0.007, 0)
      group.add(top)
      for (const z of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.014), m("strap"))
        side.position.set(0, BOARD_TOP_LOCAL + h / 2, z * (strap.hw + 0.007))
        group.add(side)
      }
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.02, 0.06), m("buckle"))
      buckle.position.set(0, strap.top + 0.016, strap.hw * 0.45)
      group.add(buckle)
      group.position.x = strap.x
      group.scale.setScalar(0.001)
      victim.add(shadowAll(group))
      return group
    })
    const groundStraps = STRAPS.map((_strap, i) => {
      const group = new THREE.Group()
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.62), m("strap"))
      band.position.y = 0.006
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.02, 0.06), m("buckle"))
      buckle.position.set(0, 0.012, -0.28)
      group.add(band, buckle)
      group.position.set(-0.66 + i * 0.22, 0, D + 0.66)
      scene.add(shadowAll(group))
      return group
    })

    const leader = new Person("leader", m)
    const rescuers = [new Person("rescuer", m), new Person("rescuer", m), new Person("rescuer", m)]
    const people = [leader, ...rescuers]
    people.forEach((person) => scene.add(person.root))
    const mix = (a: PoseSpec, b: PoseSpec, e: number) => mixPose(resolvePose(a, toVictim), resolvePose(b, toVictim), e)

    function pose(t: number, time: number) {
      const i = clamp(Math.floor(t), 0, K.length - 2)
      const fr = clamp(t - i, 0, 1)
      const a = K[i]
      const b = K[i + 1]
      const e = ease(fr)
      victim.position.set(lerp(a.v[0], b.v[0], e), lerp(a.v[1], b.v[1], e), lerp(a.v[2], b.v[2], e))
      victim.rotation.set(lerp(a.v[3], b.v[3], e) * deg, 0, 0)
      victim.updateMatrixWorld(true)
      leader.frame(mix(a.H, b.H, e))
      rescuers.forEach((rescuer, r) => rescuer.frame(mix(a.R[r], b.R[r], e)))
      const ringWeight = lerp(a.rings, b.rings, e)
      ringMat.opacity = ringWeight * (0.55 + 0.35 * Math.sin(time * 4))
      rings.forEach((ring) => {
        ring.visible = ringWeight > 0.01
      })
      const sw = lerp(a.straps, b.straps, fr)
      wrapStraps.forEach((group, n) => {
        const s = clamp(sw * 8 - n, 0, 1)
        group.scale.setScalar(Math.max(0.001, ease(s)))
        group.visible = s > 0.002
      })
      groundStraps.forEach((group, n) => {
        const s = 1 - clamp(sw * 8 - n, 0, 1)
        group.scale.setScalar(Math.max(0.001, s))
        group.visible = s > 0.002
      })
    }

    /* nhãn */
    const vLocal = (x: number, y: number, z: number) => () => victim.localToWorld(new V3(x, y, z))
    const above = (person: Person, y: number) => () => person.headW.clone().add(new V3(0, y, 0))
    const tags: SceneTag[] = [
      { label: "Chỉ huy", groups: ["prep"], position: above(leader, 0.2) },
      { label: "Cáng cứng", groups: ["prep"], position: () => new V3(0.05, 0.12, D) },
      { label: "Dây buộc", groups: ["prep"], position: () => new V3(0, 0.1, D + 0.66) },
      { label: "Nạn nhân", groups: ["prep"], position: vLocal(-0.2, 0.3, 0) },
      { label: "Đầu – cổ – cột sống", tone: "warn", groups: ["assess"], position: vLocal(-0.72, 0.42, 0) },
      { label: "Ngực – bụng", tone: "warn", groups: ["assess"], position: vLocal(-0.26, 0.5, 0) },
      { label: "Tay – chân", tone: "warn", groups: ["assess"], position: vLocal(0.52, 0.42, 0) },
      { label: "Giữ đầu", groups: ["pos"], position: above(leader, 0.22) },
      { label: "Vai và lưng", number: 1, groups: ["pos"], position: above(rescuers[0], 0.22) },
      { label: "Thắt lưng và đùi", number: 2, groups: ["pos"], position: above(rescuers[1], 0.42) },
      { label: "Khoeo và cổ chân", number: 3, groups: ["pos"], position: above(rescuers[2], 0.22) },
      { label: "Cùng bước!", tone: "say", groups: ["walk"], position: above(leader, 0.26) },
      { label: "Đầu và cột sống luôn thẳng", groups: ["lift"], position: above(leader, 0.26) },
      ...STRAPS.map((strap, i) => ({
        label: strap.name,
        number: i + 1,
        groups: ["straps"],
        position: () => victim.localToWorld(new V3(strap.x, strap.top + (i % 2 ? 0.42 : 0.2), 0)),
      })),
    ]

    return {
      tags,
      pose,
      tagGroup(t, hold) {
        const r = Math.round(t)
        if (t > 5.02 && t < 6.25) return "walk"
        if (Math.abs(t - r) < 0.18 && hold >= 0) return K[r].tags
        return null
      },
      focusPoints() {
        const focus = FOCUS.map((spec, k) => {
          pose(k, 0)
          const points: THREE.Vector3[] = []
          const who = spec.who === "all" ? people : spec.who === "leader" ? [leader] : []
          who.forEach((person) => {
            points.push(person.headW.clone().add(new V3(0, 0.32, 0)))
            person.foot.forEach((foot) => points.push(foot.position.clone()))
          })
          const local = (points3: Vec3[]) => points3.forEach(([x, y, z]) => points.push(victim.localToWorld(new V3(x, y, z))))
          local([[-0.86, 0, 0], [0.96, 0, 0], [-0.3, 0.25, 0]])
          if (spec.stretcher) {
            for (const [x, z] of [[-0.93, D - 0.23], [1.03, D - 0.23], [-0.93, D + 0.23], [1.03, D + 0.23]]) points.push(new V3(x, 0.07, z))
          }
          if (spec.ground) {
            for (const [x, z] of [[-0.7, D + 0.35], [0.7, D + 0.97]]) points.push(new V3(x, 0.15, z))
          }
          if (spec.rings) local([[-0.72, 0.5, 0], [-0.26, 0.6, 0], [0.52, 0.5, 0], [0.85, 0.1, 0.33], [0.85, 0.1, -0.33], [-0.89, 0.1, 0]])
          if (spec.strapTags) {
            STRAPS.forEach((strap, i) => points.push(victim.localToWorld(new V3(strap.x, strap.top + (i % 2 ? 0.5 : 0.3), 0))))
          }
          return points
        })
        people.forEach((person) => person.resetMotion())
        return focus
      },
    }
  },
}
