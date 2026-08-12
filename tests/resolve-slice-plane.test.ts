import { describe, expect, test } from "bun:test"
import {
  resolveSlicePlane,
  signedDistanceToSlice,
} from "lib/resolve-slice-plane"

describe("resolveSlicePlane", () => {
  test("accepts the axis-specific API", () => {
    const plane = resolveSlicePlane({
      plane: "xy",
      zOffset: 10,
      side: "z+",
    })
    expect(plane).toMatchObject({
      axis: "z",
      axisIndex: 2,
      offset: 10,
      keepSign: 1,
      capNormal: [0, 0, -1],
    })
    expect(signedDistanceToSlice([0, 0, 12], plane)).toBe(2)
    expect(signedDistanceToSlice([0, 0, 8], plane)).toBe(-2)
  })

  test("supports every plane and negative side", () => {
    expect(
      resolveSlicePlane({ plane: "yz", offset: 2, side: "x-" }),
    ).toMatchObject({ axis: "x", offset: 2, keepSign: -1 })
    expect(
      resolveSlicePlane({ plane: "xz", yOffset: -3, side: "y+" }),
    ).toMatchObject({ axis: "y", offset: -3, keepSign: 1 })
  })

  test("rejects side/plane mismatches and ambiguous offsets", () => {
    expect(() =>
      resolveSlicePlane({ plane: "xy", side: "x+" } as never),
    ).toThrow("side for the xy plane")
    expect(() =>
      resolveSlicePlane({
        plane: "xy",
        side: "z+",
        offset: 1,
        zOffset: 2,
      }),
    ).toThrow("must match")
  })
})
