import * as THREE from "three"

// Helper dùng chung cho các cảnh 3D, port từ guides/*.html.

export const V3 = THREE.Vector3
export type Vec3 = [number, number, number]

export const UP = new V3(0, 1, 0)
export const DOWN = new V3(0, -1, 0)
export const deg = Math.PI / 180

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const vec = ([x, y, z]: Vec3) => new V3(x, y, z)

export function shadowAll<T extends THREE.Object3D>(object: T): T {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  return object
}

/** Viên nang treo dọc trục -Y từ gốc toạ độ (đoạn tay, chân). */
export function capsule(r: number, length: number, material: THREE.Material) {
  const group = new THREE.Group()
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 18), material)
  cylinder.position.y = -length / 2
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), material)
  const bottom = top.clone()
  bottom.position.y = -length
  group.add(cylinder, top, bottom)
  return shadowAll(group)
}

/** Đặt một đoạn từ A hướng tới B. */
export function place(segment: THREE.Object3D, A: THREE.Vector3, B: THREE.Vector3) {
  segment.position.copy(A)
  segment.quaternion.setFromUnitVectors(DOWN, B.clone().sub(A).normalize())
}

/** IK hai khớp: trả về [khớp giữa, điểm cuối] cho chuỗi dài l1, l2 từ A tới T, gập về phía pole. */
export function ik3(
  A: THREE.Vector3,
  T: THREE.Vector3,
  l1: number,
  l2: number,
  pole: THREE.Vector3,
): [THREE.Vector3, THREE.Vector3] {
  const d = T.clone().sub(A)
  const D = d.length() || 1e-4
  const Dc = Math.min(Math.max(D, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3)
  const dir = d.multiplyScalar(1 / D)
  const a = (l1 * l1 - l2 * l2 + Dc * Dc) / (2 * Dc)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  let p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)))
  if (p.lengthSq() < 1e-6) p = new V3(0, 0, 1).cross(dir)
  p.normalize()
  return [A.clone().addScaledVector(dir, a).addScaledVector(p, h), A.clone().addScaledVector(dir, Dc)]
}

/** Bộ vật liệu nhám theo bảng màu: mỗi khoá dùng chung một material. */
export function createMaterials<K extends string>(colors: Record<K, number>) {
  const cache = new Map<K, THREE.MeshStandardMaterial>()
  return (key: K) => {
    let material = cache.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: colors[key], roughness: 0.78, metalness: 0 })
      cache.set(key, material)
    }
    return material
  }
}
export type Materials<K extends string> = (key: K) => THREE.MeshStandardMaterial

export const BASE_COLORS = {
  skin: 0xe7b08a,
  hair: 0x2a2522,
  res: 0x24426b,
  resD: 0x1a3150,
  pants: 0x2d3340,
  vest: 0xf1b820,
  vic: 0xa9b4c2,
  vicD: 0x8b98a8,
  vicP: 0x4c5566,
  shoe: 0x1e1e1e,
  white: 0xf4f6f8,
  red: 0xc8102e,
}
