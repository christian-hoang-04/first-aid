import * as THREE from "three"

import { BASE_COLORS, DOWN, UP, V3, capsule, clamp, deg, ik3, lerp, place, shadowAll, type Materials, type Vec3 } from "./kit"

export const PERSON_COLORS = { ...BASE_COLORS, byst: 0x5e7d5b, bystD: 0x4a5a48, bystP: 0x3a4038 }
export type PersonColor = keyof typeof PERSON_COLORS
export type PersonKind = "leader" | "rescuer" | "victim" | "bystander"

/** Vị trí đích của bàn tay, tính từ vai S và tư thế buông tay tự nhiên `rest`. */
export type HandFn = (S: THREE.Vector3, rest: THREE.Vector3) => THREE.Vector3

export interface PersonPose {
  p: THREE.Vector3
  yaw: number
  lean: number
  /** Quỳ (0..1). */
  k: number
  /** Quỳ cả hai gối. */
  kb: number
  /** Nằm duỗi chân trên sàn. */
  L: number
  fx: [number, number]
  fo: [number, number]
  hands: [HandFn, HandFn]
  /** Độ dày lồng ngực (ép ngực, thở). */
  chest: number
  /** Độ há miệng (0..1). */
  mouth: number
  /** Khuỷu tay mở sang hai bên khi ôm. */
  po: number
}

/** Đích bàn tay trong keyframe: buông tay, toạ độ theo nạn nhân, hoặc toạ độ thế giới. */
export type HandTarget = "rest" | Vec3 | { world: Vec3 }

/** Keyframe tư thế như trong file gốc (góc tính bằng độ). */
export interface PoseSpec {
  p: Vec3
  yaw: number
  lean: number
  k?: number
  kb?: number
  L?: number
  fx?: [number, number]
  fo?: [number, number]
  hands?: "rest" | [HandTarget, HandTarget]
  chest?: number
  mouth?: number
  po?: number
}

const restHand: HandFn = (_S, rest) => rest.clone()

export function resolvePose(spec: PoseSpec, toWorld: (local: THREE.Vector3) => THREE.Vector3): PersonPose {
  const hand = (i: 0 | 1): HandFn => {
    const target = spec.hands === undefined || spec.hands === "rest" ? "rest" : spec.hands[i]
    if (target === "rest") return restHand
    if ("world" in target) {
      const [x, y, z] = target.world
      return () => new V3(x, y, z)
    }
    const [x, y, z] = target
    return () => toWorld(new V3(x, y, z))
  }
  return {
    p: new V3(...spec.p),
    yaw: spec.yaw * deg,
    lean: spec.lean * deg,
    k: spec.k ?? 0,
    kb: spec.kb ?? 0,
    L: spec.L ?? 0,
    fx: spec.fx ? [spec.fx[0], spec.fx[1]] : [0, 0],
    fo: spec.fo ? [spec.fo[0], spec.fo[1]] : [0, 0],
    hands: [hand(0), hand(1)],
    chest: spec.chest ?? 1,
    mouth: spec.mouth ?? 0,
    po: spec.po ?? 0,
  }
}

export function mixPose(a: PersonPose, b: PersonPose, e: number): PersonPose {
  const hand = (i: 0 | 1): HandFn => (S, rest) => a.hands[i](S, rest).lerp(b.hands[i](S, rest), e)
  return {
    p: a.p.clone().lerp(b.p, e),
    yaw: lerp(a.yaw, b.yaw, e),
    lean: lerp(a.lean, b.lean, e),
    k: lerp(a.k, b.k, e),
    kb: lerp(a.kb, b.kb, e),
    L: lerp(a.L, b.L, e),
    fx: [lerp(a.fx[0], b.fx[0], e), lerp(a.fx[1], b.fx[1], e)],
    fo: [lerp(a.fo[0], b.fo[0], e), lerp(a.fo[1], b.fo[1], e)],
    hands: [hand(0), hand(1)],
    chest: lerp(a.chest, b.chest, e),
    mouth: lerp(a.mouth, b.mouth, e),
    po: lerp(a.po, b.po, e),
  }
}

/** Cộng thêm độ lệch vào các bàn tay được chọn (dùng cho chuyển động lặp). */
export function offsetHands(pose: PersonPose, which: number[], offset: () => THREE.Vector3) {
  const [h0, h1] = pose.hands
  pose.hands = [
    which.includes(0) ? (S, rest) => h0(S, rest).add(offset()) : h0,
    which.includes(1) ? (S, rest) => h1(S, rest).add(offset()) : h1,
  ]
}

/** Người dựng bằng khối cơ bản, tư thế điều khiển bằng IK, tự bước khi di chuyển. */
export class Person {
  readonly root = new THREE.Group()
  readonly torso = new THREE.Group()
  readonly pelvis: THREE.Mesh
  readonly ua: THREE.Group[]
  readonly fa: THREE.Group[]
  readonly hand: THREE.Mesh[]
  readonly th: THREE.Group[]
  readonly sh: THREE.Group[]
  readonly foot: THREE.Mesh[]
  readonly headW = new V3()
  private readonly mouthMesh?: THREE.Mesh
  private readonly m4 = new THREE.Matrix4()
  private prev: THREE.Vector3 | null = null
  private dist = 0
  private move = 0
  private readonly mdir = new V3(0, 0, 1)

  /** Khoảng duỗi bàn chân khi nằm (mỗi guide gốc dùng giá trị hơi khác nhau). */
  private readonly lyingReach: number

  constructor(kind: PersonKind, m: Materials<PersonColor>, { lyingReach = 0.84 } = {}) {
    this.lyingReach = lyingReach
    const leader = kind === "leader"
    const victim = kind === "victim"
    const bystander = kind === "bystander"
    const shirt = m(leader ? "vest" : victim ? "vic" : bystander ? "byst" : "res")
    const sleeve = m(leader ? "res" : victim ? "vicD" : bystander ? "bystD" : "resD")
    const pants = m(victim ? "vicP" : bystander ? "bystP" : "pants")

    const torsoGeometry = new THREE.CylinderGeometry(0.19, 0.16, 0.5, 24)
    torsoGeometry.scale(1, 1, 0.62)
    const body = new THREE.Mesh(torsoGeometry, shirt)
    body.position.y = 0.27
    this.torso.add(body)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 14), shirt)
    cap.scale.set(1, 0.45, 0.62)
    cap.position.y = 0.5
    this.torso.add(cap)
    if (leader) {
      const bandGeometry = new THREE.CylinderGeometry(0.184, 0.18, 0.045, 24)
      bandGeometry.scale(1, 1, 0.64)
      const band = new THREE.Mesh(bandGeometry, m("white"))
      band.position.y = 0.3
      this.torso.add(band)
    } else if (kind === "rescuer") {
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.012), m("white"))
      patch.position.set(0.075, 0.38, 0.108)
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.016, 0.006), m("red"))
      c1.position.set(0.075, 0.38, 0.116)
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.052, 0.006), m("red"))
      c2.position.set(0.075, 0.38, 0.116)
      this.torso.add(patch, c1, c2)
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.13, 14), m("skin"))
    neck.position.y = 0.57
    this.torso.add(neck)
    const head = new THREE.Group()
    head.position.set(0, 0.67, 0.015)
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), m("skin")))
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.116, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), m("hair"))
    hair.rotation.x = -0.45
    hair.position.set(0, 0.006, -0.006)
    head.add(hair)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), m("skin"))
    nose.position.set(0, -0.005, 0.108)
    head.add(nose)
    if (victim) {
      this.mouthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: 0x3a1e22, roughness: 0.78 }))
      this.mouthMesh.position.set(0, -0.052, 0.094)
      this.mouthMesh.scale.setScalar(0.001)
      head.add(this.mouthMesh)
    }
    this.torso.add(head)
    shadowAll(this.torso)

    this.pelvis = shadowAll(new THREE.Mesh(new THREE.SphereGeometry(0.165, 22, 14), pants))
    this.pelvis.scale.set(1, 0.6, 0.72)
    this.ua = [capsule(0.056, 0.31, sleeve), capsule(0.056, 0.31, sleeve)]
    this.fa = [capsule(0.05, 0.3, sleeve), capsule(0.05, 0.3, sleeve)]
    this.hand = [0, 1].map(() => shadowAll(new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 10), m("skin"))))
    this.th = [capsule(0.082, 0.44, pants), capsule(0.082, 0.44, pants)]
    this.sh = [capsule(0.07, 0.44, pants), capsule(0.07, 0.44, pants)]
    this.foot = [0, 1].map(() => shadowAll(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.25), m("shoe"))))
    this.root.add(this.torso, this.pelvis, ...this.ua, ...this.fa, ...this.hand, ...this.th, ...this.sh, ...this.foot)
  }

  /** Quên lịch sử di chuyển để không "bước" khi nhảy cảnh. */
  resetMotion() {
    this.prev = null
    this.move = 0
  }

  frame(st: PersonPose) {
    const { yaw, lean, k, kb, L } = st
    const f = new V3(Math.sin(yaw), 0, Math.cos(yaw))
    const right = new V3().crossVectors(UP, f)
    const up = f.clone().multiplyScalar(Math.sin(lean)).addScaledVector(UP, Math.cos(lean))
    const fwd = f.clone().multiplyScalar(Math.cos(lean)).addScaledVector(UP, -Math.sin(lean))
    const lie = clamp(-lean / (Math.PI / 2), 0, 1)
    const upP = UP.clone().multiplyScalar(1 - lie).addScaledVector(up, lie).normalize()
    const fP = new V3().crossVectors(right, upP)
    const pel = st.p.clone()
    if (this.prev) {
      const dv = new V3(pel.x - this.prev.x, 0, pel.z - this.prev.z)
      const dl = dv.length()
      if (dl > 1e-5) {
        this.mdir.copy(dv).normalize()
        this.dist += dl
      }
      this.move = lerp(this.move, dl > 1e-4 ? 1 : 0, 0.12)
    }
    this.prev = pel.clone()
    const walk = this.move * (1 - k) * (1 - L)
    const ph = (this.dist / 0.32) * Math.PI
    const stride = 0.13 * Math.sin(ph) * walk
    pel.y += 0.02 * Math.abs(Math.sin(ph)) * walk

    this.torso.position.copy(pel)
    this.torso.quaternion.setFromRotationMatrix(this.m4.makeBasis(right, up, fwd))
    this.torso.scale.set(1, 1, st.chest)
    this.pelvis.position.copy(pel)
    this.pelvis.quaternion.setFromRotationMatrix(this.m4.makeBasis(right, upP, fP))
    this.headW.copy(pel).addScaledVector(up, 0.8)
    this.mouthMesh?.scale.set(0.03 * st.mouth + 0.001, 0.024 * st.mouth + 0.001, 0.014 * st.mouth + 0.001)
    this.torso.updateMatrixWorld(true)

    const restDir = DOWN.clone().multiplyScalar(1 - lie).addScaledVector(up, -lie).normalize()
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const S = pel.clone().addScaledVector(up, 0.45).addScaledVector(right, side * 0.205)
      const rest = S.clone()
        .addScaledVector(restDir, 0.58)
        .addScaledVector(f, 0.05 * (1 - lie))
        .addScaledVector(right, side * (0.05 + 0.04 * lie))
      const T = st.hands[i](S, rest)
      const pole = new V3().addScaledVector(f, -0.6).addScaledVector(right, side).add(new V3(0, -0.4, 0))
      // Khuỷu tay mở sang hai bên khi ôm
      if (st.po > 0) pole.lerp(new V3().addScaledVector(f, 0.25).addScaledVector(right, side).add(new V3(0, -0.2, 0)), st.po)
      const [E, H] = ik3(S, T, 0.31, 0.3, pole)
      place(this.ua[i], S, E)
      place(this.fa[i], E, H)
      this.hand[i].position.copy(H)
    }
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const hip = pel.clone().addScaledVector(right, side * 0.095).addScaledVector(upP, -0.05)
      const base = new V3(hip.x, 0.075, hip.z)
      const pole = f.clone().add(new V3(0, 0.15, 0))
      const footS = base.clone().addScaledVector(right, st.fx[i]).addScaledVector(f, st.fo[i]).addScaledVector(this.mdir, side * stride)
      footS.y += Math.max(0, side * Math.cos(ph)) * 0.05 * walk
      const [K, A] = ik3(hip, footS, 0.44, 0.44, pole)
      // Chân trái quỳ gối dựng, chân phải quỳ gối chạm sàn (kb: cả hai gối chạm sàn)
      const wR = i === 0 ? k * (1 - kb) : 0
      const wD = i === 1 ? k : k * kb
      if (wR + wD > 1e-3) {
        K.multiplyScalar(1 - wR - wD)
        A.multiplyScalar(1 - wR - wD)
        if (wR > 1e-3) {
          const [KR, AR] = ik3(hip, base.clone().addScaledVector(f, 0.3), 0.44, 0.44, pole)
          K.addScaledVector(KR, wR)
          A.addScaledVector(AR, wR)
        }
        if (wD > 1e-3) {
          const hy = hip.y - 0.075
          const kx = Math.sqrt(Math.max(0, 0.44 * 0.44 - hy * hy))
          const kneeK = new V3(hip.x, Math.max(0.075, hip.y - 0.44), hip.z).addScaledVector(f, kx)
          const footK = kneeK.clone().addScaledVector(f, -0.42)
          footK.y = 0.075
          K.addScaledVector(kneeK, wD)
          A.addScaledVector(footK, wD)
        }
      }
      if (L > 1e-3) {
        const footL = base.clone().addScaledVector(f, this.lyingReach).addScaledVector(right, st.fx[i] || side * 0.03)
        footL.y = 0.07
        const [KL, AL] = ik3(hip, footL, 0.44, 0.44, UP.clone().addScaledVector(f, 0.1))
        K.lerp(KL, L)
        A.lerp(AL, L)
      }
      place(this.th[i], hip, K)
      place(this.sh[i], K, A)
      this.foot[i].position.copy(A).addScaledVector(f, 0.06 * (1 - L)).add(new V3(0, 0.06 * L - 0.005, 0))
      this.foot[i].rotation.set((-Math.PI / 2) * L, yaw, 0, "YXZ")
    }
  }
}
