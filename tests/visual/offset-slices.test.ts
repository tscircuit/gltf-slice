import { describe, expect, test } from "bun:test"
import { createCylinderDocument } from "tests/fixtures/create-fixture-document"
import { renderSlicedDocument } from "tests/fixtures/render-sliced-document"

describe("PoppyGL offset slice snapshots", () => {
  for (const offset of [-0.9, 0, 0.9]) {
    const name = `cylinder-z-offset-${String(offset).replace("-", "minus-").replace(".", "-")}`
    test(name, async () => {
      const png = await renderSlicedDocument(
        createCylinderDocument(),
        { plane: "xy", zOffset: offset, side: "z+" },
        {},
        {
          camPos: [5.5, -6.4, -5.2],
          lookAt: [0, 0, 0.15],
        },
      )
      await expect(png).toMatchPngSnapshot(import.meta.path, name)
    })
  }

  test("uncapped-comparison", async () => {
    const png = await renderSlicedDocument(
      createCylinderDocument(),
      { plane: "xy", zOffset: 0, side: "z+" },
      { cap: false },
      { camPos: [5.5, -6.4, -5.2] },
    )
    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      "uncapped-comparison",
    )
  })
})
