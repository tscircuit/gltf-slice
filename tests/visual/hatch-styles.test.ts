import { describe, expect, test } from "bun:test"
import type { SliceOptions } from "lib/types"
import { createBoxDocument } from "tests/fixtures/create-fixture-document"
import { renderSlicedDocument } from "tests/fixtures/render-sliced-document"

const STYLES: Array<{ name: string; hatch: SliceOptions["hatch"] }> = [
  { name: "default-hatch", hatch: {} },
  {
    name: "dense-red-hatch",
    hatch: {
      size: 128,
      spacing: 10,
      lineWidth: 2,
      background: [255, 235, 230, 255],
      lineColor: [160, 34, 34, 255],
    },
  },
  {
    name: "dark-cyan-hatch",
    hatch: {
      size: 128,
      spacing: 20,
      lineWidth: 4,
      background: [20, 46, 54, 255],
      lineColor: [84, 219, 213, 255],
    },
  },
]

describe("PoppyGL hatch material snapshots", () => {
  for (const style of STYLES) {
    test(style.name, async () => {
      const png = await renderSlicedDocument(
        createBoxDocument({ size: [2.8, 2.4, 2.2] }),
        { plane: "xy", zOffset: 0.1, side: "z+" },
        { hatch: style.hatch },
        { camPos: [4.8, -5.4, -4.7] },
      )
      await expect(png).toMatchPngSnapshot(import.meta.path, style.name)
    })
  }
})
