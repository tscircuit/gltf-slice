import { describe, expect, test } from "bun:test"
import type { RenderGLTFToPNGFromGLBOptions } from "poppygl"
import type { SliceSpec } from "lib/types"
import { createBoxDocument } from "tests/fixtures/create-fixture-document"
import { renderSlicedDocument } from "tests/fixtures/render-sliced-document"

interface AxisCase {
  name: string
  spec: SliceSpec
  camera: RenderGLTFToPNGFromGLBOptions["camPos"]
}

const CASES: AxisCase[] = [
  {
    name: "xy-keep-z-plus",
    spec: { plane: "xy", zOffset: 0, side: "z+" },
    camera: [3.6, -4.2, -3.8],
  },
  {
    name: "xy-keep-z-minus",
    spec: { plane: "xy", zOffset: 0, side: "z-" },
    camera: [3.6, -4.2, 3.8],
  },
  {
    name: "xz-keep-y-plus",
    spec: { plane: "xz", yOffset: 0, side: "y+" },
    camera: [3.8, -4.2, 3.6],
  },
  {
    name: "xz-keep-y-minus",
    spec: { plane: "xz", yOffset: 0, side: "y-" },
    camera: [3.8, 4.2, 3.6],
  },
  {
    name: "yz-keep-x-plus",
    spec: { plane: "yz", xOffset: 0, side: "x+" },
    camera: [-4.2, -3.8, 3.6],
  },
  {
    name: "yz-keep-x-minus",
    spec: { plane: "yz", xOffset: 0, side: "x-" },
    camera: [4.2, -3.8, 3.6],
  },
]

describe("PoppyGL axis slice snapshots", () => {
  for (const axisCase of CASES) {
    test(axisCase.name, async () => {
      const png = await renderSlicedDocument(
        createBoxDocument(),
        axisCase.spec,
        {},
        { camPos: axisCase.camera },
      )
      await expect(png).toMatchPngSnapshot(import.meta.path, axisCase.name)
    })
  }
})
