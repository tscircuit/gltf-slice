import { describe, expect, test } from "bun:test"
import { decode } from "fast-png"
import {
  createHatchTexture,
  resolveHatchTextureOptions,
} from "lib/create-hatch-texture"

describe("createHatchTexture", () => {
  test("creates a two-color diagonal RGBA PNG", () => {
    const png = createHatchTexture({
      size: 32,
      spacing: 8,
      lineWidth: 2,
      background: [240, 240, 240, 255],
      lineColor: [10, 20, 30, 255],
    })
    const decoded = decode(png)
    expect(decoded.width).toBe(32)
    expect(decoded.height).toBe(32)
    expect(decoded.channels).toBe(4)
    const colors = new Set<string>()
    for (let index = 0; index < decoded.data.length; index += 4) {
      colors.add(Array.from(decoded.data.slice(index, index + 4)).join(","))
    }
    expect(colors).toEqual(new Set(["10,20,30,255", "240,240,240,255"]))
  })

  test("validates pattern dimensions", () => {
    expect(() => resolveHatchTextureOptions({ size: 7 })).toThrow("at least 8")
    expect(() =>
      resolveHatchTextureOptions({ spacing: 4, lineWidth: 4 }),
    ).toThrow("smaller than spacing")
  })
})
