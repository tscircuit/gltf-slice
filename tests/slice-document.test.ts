import { describe, expect, test } from "bun:test"
import { quat } from "gl-matrix"
import { sliceDocument } from "lib/slice-document"
import { collectWorldPositions } from "tests/fixtures/collect-world-positions"
import {
  addBox,
  createBoxDocument,
  createFixtureContext,
  createMultiPrimitiveBoxDocument,
  createTubeDocument,
} from "tests/fixtures/create-fixture-document"

describe("sliceDocument", () => {
  test("slices and caps a box without mutating the source", async () => {
    const source = createBoxDocument()
    const sourceMesh = source.getRoot().listMeshes()[0]!
    const result = await sliceDocument(source, {
      plane: "xy",
      zOffset: 0,
      side: "z+",
    })

    expect(result.document).not.toBe(source)
    expect(source.getRoot().listMeshes()).toContain(sourceMesh)
    expect(result.stats.sourceTriangles).toBe(12)
    expect(result.stats.surfaceTriangles).toBeGreaterThan(0)
    expect(result.stats.capTriangles).toBeGreaterThan(0)
    expect(result.stats.capLoops).toBe(1)
    expect(result.stats.openChains).toBe(0)
    expect(
      collectWorldPositions(result.document).every(
        (point) => point[2] >= -1e-5,
      ),
    ).toBeTrue()

    const capMaterial = result.document
      .getRoot()
      .listMaterials()
      .find((material) => material.getName() === "gltf-slice interior")
    expect(capMaterial).toBeDefined()
    expect(capMaterial!.getBaseColorTexture()?.getMimeType()).toBe("image/png")
    expect(
      capMaterial!.getBaseColorTexture()?.getImage()?.byteLength,
    ).toBeGreaterThan(100)
  })

  test("retains the requested negative half-space", async () => {
    const { document } = await sliceDocument(createBoxDocument(), {
      plane: "xy",
      offset: 0.25,
      side: "z-",
    })
    expect(
      collectWorldPositions(document).every((point) => point[2] <= 0.25001),
    ).toBeTrue()
  })

  test("recognizes an interior hole when capping a tube", async () => {
    const { stats, document } = await sliceDocument(createTubeDocument(), {
      plane: "xy",
      zOffset: 0,
      side: "z+",
    })
    expect(stats.capLoops).toBe(2)
    expect(stats.capTriangles).toBeGreaterThanOrEqual(8)
    expect(stats.openChains).toBe(0)
    expect(document.getRoot().listMeshes()[0]!.listPrimitives().length).toBe(2)
  })

  test("handles planes outside the model", async () => {
    const allRemoved = await sliceDocument(createBoxDocument(), {
      plane: "xy",
      zOffset: 3,
      side: "z+",
    })
    expect(allRemoved.stats.surfaceTriangles).toBe(0)
    expect(allRemoved.stats.capTriangles).toBe(0)
    expect(allRemoved.document.getRoot().listNodes()[0]!.getMesh()).toBeNull()

    const allKept = await sliceDocument(createBoxDocument(), {
      plane: "xy",
      zOffset: -3,
      side: "z+",
    })
    expect(allKept.stats.surfaceTriangles).toBe(12)
    expect(allKept.stats.capTriangles).toBe(0)
  })

  test("slices shared mesh instances independently", async () => {
    const context = createFixtureContext("instances")
    const first = addBox(context, {
      name: "shared-box",
      translation: [-1.5, 0, 0],
    })
    const second = context.document
      .createNode("second-instance")
      .setMesh(first.getMesh())
      .setTranslation([1.5, 0, 0])
    context.scene.addChild(second)

    const { document } = await sliceDocument(context.document, {
      plane: "yz",
      xOffset: 0,
      side: "x+",
    })
    const outputFirst = document
      .getRoot()
      .listNodes()
      .find((node) => node.getName() === "shared-box")!
    const outputSecond = document
      .getRoot()
      .listNodes()
      .find((node) => node.getName() === "second-instance")!
    expect(outputFirst.getMesh()).toBeNull()
    expect(outputSecond.getMesh()).not.toBeNull()
  })

  test("uses world coordinates for transformed nodes", async () => {
    const rotation = quat.create()
    quat.fromEuler(rotation, 28, 35, 12)
    const { document, stats } = await sliceDocument(
      createBoxDocument({
        rotation: [rotation[0], rotation[1], rotation[2], rotation[3]],
        translation: [0.4, -0.2, 0.3],
        scale: [1.4, 0.8, 1.1],
      }),
      { plane: "xy", zOffset: 0, side: "z+" },
    )
    expect(stats.capLoops).toBe(1)
    expect(
      collectWorldPositions(document).every((point) => point[2] >= -1e-5),
    ).toBeTrue()
  })

  test("supports mirrored transforms", async () => {
    const { document, stats } = await sliceDocument(
      createBoxDocument({ scale: [-1, 1.2, 0.8] }),
      { plane: "yz", xOffset: 0, side: "x+" },
    )
    expect(stats.capLoops).toBe(1)
    expect(
      collectWorldPositions(document).every((point) => point[0] >= -1e-5),
    ).toBeTrue()
  })

  test("joins cut segments across material primitives", async () => {
    const { document, stats } = await sliceDocument(
      createMultiPrimitiveBoxDocument(),
      { plane: "xy", zOffset: 0, side: "z+" },
    )
    expect(stats.sourceTriangles).toBe(12)
    expect(stats.capLoops).toBe(1)
    expect(stats.openChains).toBe(0)
    expect(document.getRoot().listMeshes()[0]!.listPrimitives().length).toBe(6)
  })

  test("interpolates extra attributes on indexed geometry", async () => {
    const source = createBoxDocument()
    const primitive = source.getRoot().listMeshes()[0]!.listPrimitives()[0]!
    const position = primitive.getAttribute("POSITION")!
    const vertexCount = position.getCount()
    const buffer = source.getRoot().listBuffers()[0]!
    primitive.setIndices(
      source
        .createAccessor("indices", buffer)
        .setType("SCALAR")
        .setArray(
          new Uint16Array(
            Array.from({ length: vertexCount }, (_, index) => index),
          ),
        ),
    )
    primitive.setAttribute(
      "TEXCOORD_0",
      source
        .createAccessor("uv", buffer)
        .setType("VEC2")
        .setArray(
          new Float32Array(
            Array.from({ length: vertexCount }, (_, index) => [
              index % 2,
              (index >> 1) % 2,
            ]).flat(),
          ),
        ),
    )
    primitive.setAttribute(
      "COLOR_0",
      source
        .createAccessor("color", buffer)
        .setType("VEC4")
        .setArray(
          new Uint8Array(
            Array.from({ length: vertexCount }, () => [
              255, 128, 32, 255,
            ]).flat(),
          ),
        )
        .setNormalized(true),
    )

    const { document } = await sliceDocument(source, {
      plane: "xy",
      zOffset: 0.25,
      side: "z+",
    })
    const surface = document
      .getRoot()
      .listMeshes()[0]!
      .listPrimitives()
      .find(
        (candidate) => candidate.getMaterial()?.getName() === "fixture blue",
      )!
    expect(surface.listSemantics()).toEqual([
      "POSITION",
      "NORMAL",
      "TEXCOORD_0",
      "COLOR_0",
    ])
    expect(surface.getAttribute("TEXCOORD_0")?.getCount()).toBe(
      surface.getAttribute("POSITION")?.getCount(),
    )
    expect(surface.getAttribute("COLOR_0")?.getNormalized()).toBeFalse()
  })
})
