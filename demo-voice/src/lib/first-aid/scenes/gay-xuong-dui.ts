import * as THREE from "three"

import type { GuideSceneDefinition, KeyClock, SceneTag } from "./engine"
import { BASE_COLORS, V3, clamp, createMaterials, ease, lerp, shadowAll, type Vec3 } from "./kit"
import { PERSON_COLORS, Person, mixPose, resolvePose, type HandTarget, type PersonPose, type PoseSpec } from "./person"

// Port từ guides/gay-xuong-dui-3d.html: cố định gãy xương đùi bằng nẹp hai bên.
// Nạn nhân nằm dọc trục X (đầu về phía −X); chân gãy là chân phải, phía người cứu (−Z).

type Role = "V" | "L" | "R" | "F"
interface Equipment {
  thread: number
  spread: number
  splint: number
  pads: number
  tied: number
  check: number
}
interface Keyframe {
  V: PoseSpec
  L: PoseSpec
  R: PoseSpec
  F: PoseSpec
  eq: Partial<Equipment>
  tags: string
  cycle?: "tie"
  who: Role[]
}
type SceneState = Record<Role, PersonPose> & { eq: Equipment }

const EQ0: Equipment = { thread: 0, spread: 0, splint: 0, pads: 0, tied: 0, check: 0 }
const EQ_KEYS = Object.keys(EQ0).filter((key): key is keyof Equipment => key in EQ0)

const W = (x: number, y: number, z: number): HandTarget => ({ world: [x, y, z] })
const VREC: PoseSpec = { p: [0, 0.13, 0], yaw: 90, lean: -55, L: 1, fx: [-0.06, 0.06], hands: [W(-0.55, 0.06, 0.3), W(-0.55, 0.06, -0.3)] }
const VLIE: PoseSpec = { p: [0, 0.12, 0], yaw: 90, lean: -90, L: 1, fx: [-0.06, 0.06], hands: [W(-0.1, 0.06, 0.5), W(-0.1, 0.06, -0.5)] }
const KN = (x: number, lean: number, hands: PoseSpec["hands"]): PoseSpec => ({ p: [x, 0.45, -0.7], yaw: 0, lean, k: 1, kb: 1, hands })
const ST = (x: number, z: number, yaw = 0): PoseSpec => ({ p: [x, 0.95, z], yaw, lean: 0 })
const FAM_NEAR: PoseSpec = { p: [-1.3, 0.95, 0.85], yaw: 125, lean: 8 }
const FAM_BACK: PoseSpec = { p: [-1.65, 0.95, 1.15], yaw: 125, lean: 0 }
const SHOULDER: Vec3 = [0.2, 0.45, 0.06] // vai phải nạn nhân (toạ độ theo nạn nhân)

const K: Keyframe[] = [
  { V: VREC, L: ST(-0.55, -1.0), R: ST(0.45, -1.0), F: FAM_NEAR, eq: {}, tags: "prep", who: ["V", "L", "R", "F"] },
  { V: VREC, L: KN(-0.45, 20, ["rest", SHOULDER]), R: ST(0.45, -1.0), F: FAM_NEAR, eq: {}, tags: "talk", who: ["V", "L", "F"] },
  { V: VLIE, L: KN(-0.5, 35, ["rest", SHOULDER]), R: ST(0.45, -1.0), F: FAM_BACK, eq: {}, tags: "lie", who: ["V", "L"] },
  {
    V: VLIE,
    L: KN(-0.12, 60, [W(-0.17, 0.1, -0.27), W(-0.07, 0.1, -0.27)]),
    R: KN(0.62, 60, [W(0.48, 0.1, -0.26), W(0.8, 0.1, -0.26)]),
    F: FAM_BACK,
    eq: { thread: 1 },
    tags: "thread",
    who: ["V", "L", "R"],
  },
  {
    V: VLIE,
    L: KN(-0.12, 58, [W(-0.3, 0.1, -0.33), W(0.0, 0.1, -0.33)]),
    R: KN(0.55, 58, [W(0.3, 0.1, -0.33), W(0.72, 0.1, -0.33)]),
    F: FAM_BACK,
    eq: { thread: 1, spread: 1 },
    tags: "spread",
    who: ["V", "L", "R"],
  },
  {
    V: VLIE,
    L: KN(-0.2, 55, [W(-0.38, 0.11, -0.26), W(-0.05, 0.11, -0.26)]),
    R: KN(0.62, 60, [W(0.6, 0.1, -0.07), W(0.95, 0.11, -0.26)]),
    F: FAM_BACK,
    eq: { thread: 1, spread: 1, splint: 1 },
    tags: "splint",
    who: ["V", "L", "R"],
  },
  {
    V: VLIE,
    L: KN(-0.25, 55, [W(-0.37, 0.1, -0.23), W(-0.1, 0.11, -0.26)]),
    R: KN(0.65, 58, [W(0.485, 0.1, -0.23), W(0.9, 0.1, -0.23)]),
    F: FAM_BACK,
    eq: { thread: 1, spread: 1, splint: 1, pads: 1 },
    tags: "pads",
    who: ["V", "L", "R"],
  },
  {
    V: VLIE,
    L: KN(-0.1, 55, [W(-0.2, 0.11, -0.265), W(0.0, 0.11, -0.265)]),
    R: KN(0.45, 55, [W(0.35, 0.11, -0.265), W(0.6, 0.11, -0.265)]),
    F: FAM_BACK,
    eq: { thread: 1, spread: 1, splint: 1, pads: 1 },
    tags: "tie",
    cycle: "tie",
    who: ["V", "L", "R"],
  },
  {
    V: VLIE,
    L: KN(-0.3, 20, "rest"),
    R: KN(0.85, 50, [W(0.94, 0.24, -0.15), W(0.86, 0.12, -0.22)]),
    F: FAM_BACK,
    eq: { thread: 1, spread: 1, splint: 1, pads: 1, tied: 9, check: 1 },
    tags: "check",
    who: ["V", "R"],
  },
  {
    V: VLIE,
    L: ST(-0.45, -0.95),
    R: ST(0.5, -0.95),
    F: { p: [-1.4, 0.95, 0.9], yaw: 125, lean: 0 },
    eq: { thread: 1, spread: 1, splint: 1, pads: 1, tied: 9 },
    tags: "go",
    who: ["V", "L", "R", "F"],
  },
]

const Z0 = -0.29 // phía xa của mọi vòng dây, ngoài nẹp ngoài
/** Theo thứ tự buộc ở bước 7. */
const TIES = [
  { name: "Trên ổ gãy", x: 0.25, z1: 0.009, h: 0.235, tx: 0.44 },
  { name: "Dưới ổ gãy", x: 0.41, z1: -0.004, h: 0.24, tx: 0.47 },
  { name: "Dưới khớp gối", x: 0.58, z1: -0.018, h: 0.22, tx: 0.5 },
  { name: "Ngang hông", x: 0.0, z1: 0.185, h: 0.26, tx: -0.1 },
  { name: "Ngang ngực", x: -0.32, z1: 0.215, h: 0.26, tx: -0.14 },
  { name: "Sát bẹn", x: 0.17, z1: -0.012, h: 0.23, tx: 0.41 },
  { name: "Cổ chân", x: 0.81, z1: -0.037, h: 0.18, tx: 0.8 },
  { name: "Hai chân, đầu gối", x: 0.5, z1: 0.22, h: 0.25, tx: 0.53 },
  { name: "Hai chân, cổ chân", x: 0.865, z1: 0.24, h: 0.175, tx: 0.84 },
]
const THREAD_RANK = [2, 3, 4, 1, 0, 5, 7, 6, 8] // luồn dây eo trước, rồi khoeo, rồi cổ chân
const knotPos = (i: number) => new V3(TIES[i].x, TIES[i].h + 0.03, Z0 + 0.045)

// Bước 7: các dây được buộc lần lượt (nhịp theo lời đọc gốc).
const TAU0 = 1.6
const PER_TIE = Math.max(0.95, Math.min(2.2, (11.87 - 4.1) / 9))
const TIE_HANDLERS: ("L" | "R")[] = ["L", "R"]
const handlerOf = (i: number): "L" | "R" => (TIES[i].x <= 0.17 ? "L" : "R")
const RANGE_X = { L: [-0.35, 0.15], R: [0.3, 0.85] }

const SPLINTS = [
  { len: 1.41, placed: { x: 0.345, z: -0.255, ry: 0 }, kit: { x: 0.35, z: 0.75 } }, // hõm nách tới quá cổ chân
  { len: 0.865, placed: { x: 0.62, z: -0.0415, ry: Math.atan2(0.071, 0.86) }, kit: { x: 0.55, z: 0.9 } }, // nếp bẹn tới quá cổ chân
]
const PADS: Vec3[] = [
  [-0.33, 0.07, -0.225],
  [0.21, 0.07, 0.006],
  [0.485, 0.07, -0.23],
  [0.485, 0.07, -0.025],
  [0.485, 0.07, 0.016],
  [0.9, 0.06, -0.235],
  [0.9, 0.06, -0.08],
  [0.9, 0.06, 0.03],
]

export const gayXuongDuiScene: GuideSceneDefinition = {
  ranges: [[0, 0], [1, 1], [2, 2], [3, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9]],
  segmentDurations: [2.2, 2.6, 2.6, 2.6, 3.0, 2.2, 1.4, 2.0, 2.2],
  narrationDurations: [3.35, 3.84, 1.42, 12.4, 4.79, 3.71, 11.87, 2.14, 2.07],
  far: 80,
  shots: [
    { p: [0.9, 2.4, 3.6], l: [0.0, 0.3, 0.2] }, // 0 dụng cụ bày cạnh nạn nhân
    { p: [0.4, 1.7, 3.0], l: [-0.6, 0.5, 0.0] }, // 1 người cứu, nạn nhân, người nhà
    { p: [0.8, 1.6, 2.8], l: [-0.3, 0.3, 0.0] }, // 2 nạn nhân nằm ngửa
    { p: [1.0, 1.3, 2.6], l: [0.3, 0.2, 0.0] }, // 3 thấp: luồn dây dưới người
    { p: [0.4, 3.0, 1.8], l: [0.25, 0.1, 0.0] }, // 4 từ trên: rải dây đúng chỗ
    { p: [0.6, 2.6, 2.4], l: [0.3, 0.1, -0.1] }, // 5 đặt nẹp
    { p: [1.4, 2.2, 2.2], l: [0.4, 0.1, -0.1] }, // 6 đệm lót
    { p: [0.5, 3.0, 2.0], l: [0.25, 0.15, -0.05] }, // 7 từ trên: buộc dây theo thứ tự
    { p: [2.0, 1.2, 1.2], l: [0.7, 0.2, -0.2] }, // 8 bàn chân bị thương
    { p: [1.2, 2.2, 3.4], l: [0.0, 0.4, 0.0] }, // 9 sẵn sàng chuyển
  ],

  build(scene) {
    const m = createMaterials({ ...PERSON_COLORS, board: 0xe8762d, boardD: 0xb9541a, strap: 0x1f2328, pad: 0xf4f6f8 })
    m("pad").roughness = 1
    const options = { lyingReach: 0.87 }
    const people: Record<Role, Person> = {
      V: new Person("victim", m, options),
      L: new Person("leader", m, options),
      R: new Person("rescuer", m, options),
      F: new Person("bystander", m, options),
    }
    Object.values(people).forEach((person) => scene.add(person.root))
    const victim = people.V
    const resolve = (spec: PoseSpec) => resolvePose(spec, (local) => victim.torso.localToWorld(local))

    /* dụng cụ */
    const tieFloor: THREE.Mesh[] = []
    const tieLoop: THREE.Group[] = []
    const tieKit: THREE.Mesh[] = []
    const unitZ = new THREE.BoxGeometry(1, 1, 1)
    unitZ.translate(0, 0, 0.5)
    TIES.forEach((tie, i) => {
      const floorStrap = new THREE.Mesh(unitZ, m("strap"))
      floorStrap.scale.set(0.035, 0.006, 1)
      floorStrap.position.y = 0.003
      floorStrap.receiveShadow = true
      scene.add(floorStrap)
      tieFloor.push(floorStrap)
      const loop = new THREE.Group()
      loop.position.x = tie.x
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, tie.z1 - Z0), m("strap"))
      top.position.set(0, tie.h, (Z0 + tie.z1) / 2)
      loop.add(top)
      for (const z of [Z0, tie.z1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, tie.h, 0.012), m("strap"))
        side.position.set(0, tie.h / 2, z)
        loop.add(side)
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), m("strap"))
      knot.position.set(0, tie.h + 0.012, Z0 + 0.045)
      loop.add(knot)
      scene.add(shadowAll(loop))
      tieLoop.push(loop)
      const kit = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.5), m("strap"))
      kit.position.set(-0.22 + i * 0.09, 0.003, 1.12)
      scene.add(kit)
      tieKit.push(kit)
    })
    // nẹp: vị trí đặt (dựng cạnh chân) và vị trí trong bộ dụng cụ (nằm phẳng)
    const splintMesh = SPLINTS.map((splint) => {
      const mesh = shadowAll(new THREE.Mesh(new THREE.BoxGeometry(splint.len, 0.09, 0.025), m("board")))
      scene.add(mesh)
      return mesh
    })
    const padGeometry = new THREE.SphereGeometry(1, 16, 10)
    const padMesh = PADS.map(([x, y, z]) => {
      const mesh = shadowAll(new THREE.Mesh(padGeometry, m("pad")))
      mesh.position.set(x, y, z)
      scene.add(mesh)
      return mesh
    })
    const padKit = PADS.map((_pad, i) => {
      const mesh = shadowAll(new THREE.Mesh(padGeometry, m("pad")))
      mesh.position.set(-0.6 + (i % 4) * 0.1, 0.03 + Math.floor(i / 4) * 0.04, 0.85 + (i % 2) * 0.05)
      scene.add(mesh)
      return mesh
    })
    // vòng ổ gãy (luôn hiện) và vòng kiểm tra lưu thông máu (bước 8)
    const ringMat = new THREE.MeshBasicMaterial({ color: BASE_COLORS.red, transparent: true, opacity: 0.7, depthWrite: false })
    const fractureRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.01, 8, 48), ringMat)
    fractureRing.rotation.y = Math.PI / 2
    fractureRing.position.set(0.33, 0.138, -0.114)
    scene.add(fractureRing)
    const checkMat = new THREE.MeshBasicMaterial({ color: BASE_COLORS.red, transparent: true, opacity: 0, depthWrite: false })
    const checkRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.011, 8, 48), checkMat)
    checkRing.rotation.x = Math.PI / 2
    checkRing.position.set(0.92, 0.2, -0.155)
    scene.add(checkRing)

    /* trạng thái theo keyframe */
    const mixState = (a: SceneState, b: SceneState, e: number): SceneState => {
      const eq = { ...EQ0 }
      EQ_KEYS.forEach((key) => {
        eq[key] = lerp(a.eq[key], b.eq[key], e)
      })
      return { V: mixPose(a.V, b.V, e), L: mixPose(a.L, b.L, e), R: mixPose(a.R, b.R, e), F: mixPose(a.F, b.F, e), eq }
    }

    let curTie = -1
    function tieState(tau: number, S: SceneState) {
      const ti = clamp((tau - TAU0) / PER_TIE, -1, 9)
      let tied = 0
      for (let i = 0; i < 9; i++) tied += clamp((ti - i - 0.35) / 0.45, 0, 1)
      S.eq.tied = tied
      const c = ti < 0 ? -1 : Math.min(8, Math.floor(ti))
      curTie = ti >= 9 ? 9 : c
      for (const who of TIE_HANDLERS) {
        const P = S[who]
        let j = -1
        let jp = -1
        for (let i = 0; i <= c; i++) {
          if (handlerOf(i) === who) {
            jp = j
            j = i
          }
        }
        if (j < 0) continue
        const xOf = (n: number) => (n < 0 ? P.p.x : clamp(TIES[n].x, RANGE_X[who][0], RANGE_X[who][1]))
        P.p.x = lerp(xOf(jp), xOf(j), ease(clamp((ti - j) / 0.35, 0, 1)))
        if (c === j && ti - j < 0.9) {
          const knot = knotPos(j)
          P.hands = [() => knot.clone().add(new V3(-0.05, 0, 0)), () => knot.clone().add(new V3(0.05, 0, 0))]
        } else {
          const px = P.p.x
          P.hands = [() => new V3(px - 0.12, 0.11, -0.265), () => new V3(px + 0.12, 0.11, -0.265)]
        }
      }
    }
    function stateAt(i: number, tau: number): SceneState {
      const k = K[i]
      const S: SceneState = { V: resolve(k.V), L: resolve(k.L), R: resolve(k.R), F: resolve(k.F), eq: { ...EQ0, ...k.eq } }
      if (k.cycle === "tie") tieState(tau, S)
      return S
    }

    const tieAmount = new Array<number>(9).fill(0)
    function applyEquipment(eq: Equipment, time: number) {
      TIES.forEach((tie, i) => {
        const thread = clamp(eq.thread * 1.6 - (0.6 * THREAD_RANK[i]) / 8, 0, 1)
        const s = clamp(eq.tied - i, 0, 1)
        tieAmount[i] = s
        const floorStrap = tieFloor[i]
        floorStrap.position.x = lerp(tie.tx, tie.x, eq.spread)
        floorStrap.position.z = lerp(-0.55, Z0, s)
        floorStrap.scale.z = Math.max(0.001, lerp(1.1 * thread, tie.z1 - Z0, s))
        floorStrap.visible = thread > 0.001
        tieKit[i].scale.z = Math.max(0.001, 1 - thread)
        tieKit[i].visible = thread < 0.999
        tieLoop[i].scale.y = Math.max(0.001, ease(s))
        tieLoop[i].visible = s > 0.001
      })
      SPLINTS.forEach((splint, i) => {
        const e = clamp(eq.splint * 1.25 - i * 0.25, 0, 1)
        splintMesh[i].position.set(
          lerp(splint.kit.x, splint.placed.x, e),
          lerp(0.0125, 0.045, e) + Math.sin(Math.PI * e) * 0.5,
          lerp(splint.kit.z, splint.placed.z, e),
        )
        splintMesh[i].rotation.set(lerp(Math.PI / 2, 0, e), lerp(0, splint.placed.ry, e), 0, "YXZ")
      })
      PADS.forEach((_pad, i) => {
        const s = clamp(eq.pads * 1.6 - (0.6 * i) / 7, 0, 1)
        padMesh[i].scale.set(0.07 * s + 0.001, 0.05 * s + 0.001, 0.028 * s + 0.001)
        padMesh[i].visible = s > 0.001
        padKit[i].scale.set(0.05 * (1 - s) + 0.001, 0.03 * (1 - s) + 0.001, 0.04 * (1 - s) + 0.001)
        padKit[i].visible = s < 0.999
      })
      checkMat.opacity = eq.check * (0.55 + 0.35 * Math.sin(time * 4))
      checkRing.visible = checkMat.opacity > 0.01
    }

    function pose(t: number, time: number, clock: KeyClock) {
      const i = clamp(Math.floor(t), 0, K.length - 2)
      const fr = clamp(t - i, 0, 1)
      let S: SceneState
      if (fr < 1e-6) S = stateAt(i, clock.atTime)
      else if (fr > 1 - 1e-6) S = stateAt(i + 1, clock.atTime)
      else S = mixState(stateAt(i, clock.lastKey === i ? clock.lastTau : 0), stateAt(i + 1, clock.lastKey === i + 1 ? clock.lastTau : 0), ease(fr))
      victim.frame(S.V)
      victim.torso.updateMatrixWorld(true)
      people.L.frame(S.L)
      people.R.frame(S.R)
      people.F.frame(S.F)
      applyEquipment(S.eq, time)
    }

    /* nhãn */
    const P3 = (x: number, y: number, z: number) => () => new V3(x, y, z)
    const above = (person: Person) => () => person.headW.clone().add(new V3(0, 0.3, 0))
    const tags: SceneTag[] = [
      { label: "2 nẹp", groups: ["prep"], position: P3(0.45, 0.1, 0.83) },
      { label: "9 dây buộc", groups: ["prep"], position: P3(0.15, 0.06, 1.12) },
      { label: "Bông, vải, giấy mềm", groups: ["prep"], position: P3(-0.45, 0.12, 0.88) },
      { label: "Ổ gãy", tone: "warn", groups: ["prep"], position: P3(0.33, 0.32, -0.114) },
      { label: "An ủi, giải thích", groups: ["talk"], position: above(people.L) },
      { label: "Người nhà", groups: ["talk"], position: above(people.F) },
      { label: "Nằm ngửa", groups: ["lie"], position: P3(-0.35, 0.45, 0.05) },
      { label: "Eo lưng: 2 dây", groups: ["thread"], position: P3(-0.12, 0.06, 0.58) },
      { label: "Khoeo: 5 dây", groups: ["thread"], position: P3(0.49, 0.06, 0.58) },
      { label: "Cổ chân: 2 dây", groups: ["thread"], position: P3(0.84, 0.06, 0.58) },
      { label: "Ngực, hông", groups: ["spread"], position: P3(-0.16, 0.06, 0.58) },
      { label: "Bẹn, ổ gãy, gối", groups: ["spread"], position: P3(0.37, 0.06, 0.58) },
      { label: "Cổ chân", groups: ["spread"], position: P3(0.84, 0.06, 0.58) },
      { label: "Từ hõm nách", groups: ["splint"], position: P3(-0.36, 0.16, -0.255) },
      { label: "Từ nếp bẹn", groups: ["splint"], position: P3(0.19, 0.2, -0.006) },
      { label: "Quá cổ chân", groups: ["splint"], position: P3(1.05, 0.16, -0.17) },
      { label: "Đầu nẹp", groups: ["pads"], position: P3(-0.33, 0.16, -0.225) },
      { label: "Đầu gối", groups: ["pads"], position: P3(0.485, 0.24, -0.1) },
      { label: "Cổ chân", groups: ["pads"], position: P3(0.9, 0.3, -0.1) },
      ...TIES.flatMap((tie, i): SceneTag[] => [
        { label: tie.name, number: i + 1, groups: [`tie-${i}`], position: () => knotPos(i).add(new V3(0, 0.1, 0)) },
        {
          label: String(i + 1),
          tone: "mini",
          groups: [],
          position: () => knotPos(i).add(new V3(0, 0.05, 0)),
          visible: (group) => group !== null && group.startsWith("tie-") && tieAmount[i] > 0.999 && i !== curTie,
        },
      ]),
      { label: "Lưu thông máu", tone: "warn", groups: ["check"], position: P3(0.92, 0.42, -0.155) },
      { label: "Chuyển đến cơ sở y tế", groups: ["go"], position: P3(-0.2, 0.7, 0) },
    ]

    return {
      tags,
      pose,
      tagGroup(t) {
        const r = Math.round(t)
        if (Math.abs(t - r) >= 0.18) return null
        return K[r].tags === "tie" ? `tie-${curTie}` : K[r].tags
      },
      focusPoints() {
        const focus = K.map((keyframe, k) => {
          const tau = keyframe.cycle === "tie" ? 1e3 : 0
          pose(k, 0, { atTime: tau, lastKey: k, lastTau: tau })
          const points: THREE.Vector3[] = []
          keyframe.who.forEach((role) => {
            const person = people[role]
            points.push(person.headW.clone().add(new V3(0, 0.25, 0)))
            person.foot.forEach((foot) => points.push(foot.position.clone()))
            person.hand.forEach((hand) => points.push(hand.position.clone()))
          })
          tags.forEach((tag) => {
            if (tag.groups.includes(keyframe.tags)) points.push(tag.position().add(new V3(0, 0.1, 0)))
          })
          if (keyframe.tags === "tie") TIES.forEach((_tie, i) => points.push(knotPos(i).add(new V3(0, 0.15, 0))))
          return points
        })
        curTie = -1
        Object.values(people).forEach((person) => person.resetMotion())
        return focus
      },
    }
  },
}
