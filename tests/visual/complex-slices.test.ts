import { describe, expect, test } from "bun:test"
import { quat } from "gl-matrix"
import {
  addBox,
  createBoxDocument,
  createCylinderDocument,
  createFixtureContext,
  createTubeDocument,
} from "tests/fixtures/create-fixture-document"
import { renderSlicedDocument } from "tests/fixtures/render-sliced-document"

describe("PoppyGL complex slice snapshots", () => {
  test("rectangular-tube-hole", async () => {
    const png = await renderSlicedDocument(
      createTubeDocument(),
      { plane: "xy", zOffset: 0, side: "z+" },
      {},
      { camPos: [5.8, -6.8, -5.5] },
    )
    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      "rectangular-tube-hole",
    )
  })

  test("rotated-scaled-box", async () => {
    const rotation = quat.create()
    quat.fromEuler(rotation, 28, 35, 12)
    const document = createBoxDocument({
      rotation: [rotation[0], rotation[1], rotation[2], rotation[3]],
      translation: [0.4, -0.2, 0.3],
      scale: [1.4, 0.8, 1.1],
    })
    const png = await renderSlicedDocument(
      document,
      { plane: "xy", zOffset: 0, side: "z+" },
      {},
      { camPos: [4.8, -5.4, -4.6], lookAt: [0.3, -0.1, 0.3] },
    )
    await expect(png).toMatchPngSnapshot(import.meta.path, "rotated-scaled-box")
  })

  test("multiple-disconnected-solids", async () => {
    const context = createFixtureContext("multiple-solids")
    addBox(context, {
      name: "left",
      size: [1.5, 1.8, 2.4],
      translation: [-1.15, 0, 0.15],
    })
    addBox(context, {
      name: "right",
      size: [1.25, 1.25, 1.8],
      translation: [1.05, 0.25, -0.2],
      rotation: [0, 0, 0.18, 0.984],
    })
    const png = await renderSlicedDocument(
      context.document,
      { plane: "xy", zOffset: 0, side: "z+" },
      {},
      { camPos: [6.4, -7.2, -5.8] },
    )
    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      "multiple-disconnected-solids",
    )
  })

  test("nested-node-transform", async () => {
    const context = createFixtureContext("nested-transform")
    const parentRotation = quat.create()
    quat.fromEuler(parentRotation, 0, 30, 18)
    const parent = context.document
      .createNode("parent")
      .setRotation([
        parentRotation[0],
        parentRotation[1],
        parentRotation[2],
        parentRotation[3],
      ])
      .setTranslation([0.25, 0.15, 0.2])
    context.scene.addChild(parent)
    addBox(context, {
      name: "nested-box",
      size: [2.4, 1.5, 2.1],
      translation: [0.4, -0.15, 0],
      parent,
    })
    const png = await renderSlicedDocument(
      context.document,
      { plane: "yz", xOffset: 0.2, side: "x+" },
      {},
      { camPos: [-5.2, -4.8, 4.5], lookAt: [0.3, 0, 0.2] },
    )
    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      "nested-node-transform",
    )
  })

  test("cylinder-side-section", async () => {
    const png = await renderSlicedDocument(
      createCylinderDocument(40),
      { plane: "xz", yOffset: 0.35, side: "y-" },
      {},
      { camPos: [5.8, 6.5, 5.2] },
    )
    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      "cylinder-side-section",
    )
  })
})
