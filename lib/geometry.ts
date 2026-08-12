import { mat3, mat4, vec3 } from "gl-matrix"
import type { Vec3 } from "./types"

export function transformPoint(matrix: mat4, point: Vec3): Vec3 {
  const output = vec3.transformMat4(vec3.create(), point, matrix)
  return [output[0], output[1], output[2]]
}

export function invertMatrix(matrix: mat4): mat4 {
  const inverse = mat4.invert(mat4.create(), matrix)
  if (!inverse) throw new Error("cannot slice a node with a singular transform")
  return inverse
}

export function worldNormalToLocal(matrix: mat4, normal: Vec3): Vec3 {
  const linear = mat3.fromMat4(mat3.create(), matrix)
  mat3.transpose(linear, linear)
  const output = vec3.transformMat3(vec3.create(), normal, linear)
  vec3.normalize(output, output)
  return [output[0], output[1], output[2]]
}

export function interpolate(a: number[], b: number[], t: number): number[] {
  return a.map((value, index) => value + ((b[index] ?? value) - value) * t)
}

export function normalizeAttribute(
  semantic: string,
  value: number[],
): number[] {
  if (semantic !== "NORMAL" && semantic !== "TANGENT") return value
  const length = Math.hypot(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0)
  if (length > 0) {
    value[0] = (value[0] ?? 0) / length
    value[1] = (value[1] ?? 0) / length
    value[2] = (value[2] ?? 0) / length
  }
  if (semantic === "TANGENT" && value.length > 3) {
    value[3] = (value[3] ?? 1) < 0 ? -1 : 1
  }
  return value
}

export function squaredDistance(a: Vec3, b: Vec3): number {
  const x = a[0] - b[0]
  const y = a[1] - b[1]
  const z = a[2] - b[2]
  return x * x + y * y + z * z
}

export function triangleNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  return [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
