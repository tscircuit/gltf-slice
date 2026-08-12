import type { SlicePlane, SliceSide, SliceSpec, Vec3 } from "./types"

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const

export interface ResolvedSlicePlane {
  plane: SlicePlane
  side: SliceSide
  axis: "x" | "y" | "z"
  axisIndex: 0 | 1 | 2
  offset: number
  keepSign: 1 | -1
  keepNormal: Vec3
  capNormal: Vec3
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`)
  }
}

export function resolveSlicePlane(spec: SliceSpec): ResolvedSlicePlane {
  if (!spec || typeof spec !== "object") {
    throw new TypeError("slice spec must be an object")
  }

  const axis =
    spec.plane === "xy"
      ? "z"
      : spec.plane === "xz"
        ? "y"
        : spec.plane === "yz"
          ? "x"
          : null

  if (!axis) {
    throw new TypeError('plane must be one of "xy", "xz", or "yz"')
  }

  const expectedSides = [`${axis}+`, `${axis}-`] as const
  if (!expectedSides.includes(spec.side as (typeof expectedSides)[number])) {
    throw new TypeError(
      `side for the ${spec.plane} plane must be "${expectedSides[0]}" or "${expectedSides[1]}"`,
    )
  }

  const specificKey = `${axis}Offset` as "xOffset" | "yOffset" | "zOffset"
  const specificOffset = (
    spec as unknown as Record<string, number | undefined>
  )[specificKey]
  const genericOffset = spec.offset

  if (specificOffset !== undefined) assertFinite(specificOffset, specificKey)
  if (genericOffset !== undefined) assertFinite(genericOffset, "offset")
  if (
    specificOffset !== undefined &&
    genericOffset !== undefined &&
    specificOffset !== genericOffset
  ) {
    throw new TypeError(
      `offset and ${specificKey} must match when both are provided`,
    )
  }

  const offset = specificOffset ?? genericOffset ?? 0
  const keepSign = spec.side.endsWith("+") ? 1 : -1
  const keepNormal: Vec3 = [0, 0, 0]
  keepNormal[AXIS_INDEX[axis]] = keepSign
  const capNormal: Vec3 = [0, 0, 0]
  capNormal[AXIS_INDEX[axis]] = -keepSign

  return {
    plane: spec.plane,
    side: spec.side,
    axis,
    axisIndex: AXIS_INDEX[axis],
    offset,
    keepSign,
    keepNormal,
    capNormal,
  }
}

export function signedDistanceToSlice(
  point: Vec3,
  plane: ResolvedSlicePlane,
): number {
  return plane.keepSign * (point[plane.axisIndex] - plane.offset)
}

export function snapPointToSlice(point: Vec3, plane: ResolvedSlicePlane): Vec3 {
  const snapped: Vec3 = [...point]
  snapped[plane.axisIndex] = plane.offset
  return snapped
}

export function projectPointToSlice(
  point: Vec3,
  plane: ResolvedSlicePlane,
): [number, number] {
  switch (plane.plane) {
    case "xy":
      return [point[0], point[1]]
    case "xz":
      return [point[0], point[2]]
    case "yz":
      return [point[1], point[2]]
  }
}

export function unprojectPointFromSlice(
  point: [number, number],
  plane: ResolvedSlicePlane,
): Vec3 {
  switch (plane.plane) {
    case "xy":
      return [point[0], point[1], plane.offset]
    case "xz":
      return [point[0], plane.offset, point[1]]
    case "yz":
      return [plane.offset, point[0], point[1]]
  }
}
