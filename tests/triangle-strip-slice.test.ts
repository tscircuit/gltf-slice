import { describe, expect, test } from "bun:test"
import { Primitive } from "@gltf-transform/core"
import { sliceDocument } from "lib/slice-document"
import { collectWorldPositions } from "tests/fixtures/collect-world-positions"
import { createFixtureContext } from "tests/fixtures/create-fixture-document"

type GltfPrimitiveMode = NonNullable<(typeof Primitive.Mode)[string]>

function addModeMesh(
  mode: GltfPrimitiveMode,
  positions: number[],
  name: string,
) {
  const context = createFixtureContext(name)
  const positionAccessor = context.document
    .createAccessor(`${name}-position`, context.buffer)
    .setType("VEC3")
    .setArray(new Float32Array(positions))
  const primitive = context.document
    .createPrimitive()
    .setMode(mode)
    .setAttribute("POSITION", positionAccessor)
  const mesh = context.document.createMesh(name).addPrimitive(primitive)
  context.scene.addChild(context.document.createNode(name).setMesh(mesh))
  return context.document
}

/** Quad on the XY plane: strip vertices (-1,-1), (1,-1), (-1,1), (1,1). */
const QUAD_STRIP = [-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]

describe("non-TRIANGLES mesh modes", () => {
  test("TRIANGLE_STRIP primitives are sliced instead of cloned unsliced", async () => {
    const source = addModeMesh(
      Primitive.Mode.TRIANGLE_STRIP!,
      QUAD_STRIP,
      "strip-quad",
    )
    const { stats, document } = await sliceDocument(source, {
      plane: "xz",
      yOffset: 0,
      side: "y+",
    })

    expect(stats.sourceTriangles).toBe(2)
    expect(stats.surfaceTriangles).toBeGreaterThan(0)
    expect(
      collectWorldPositions(document).every((point) => point[1] >= -1e-5),
    ).toBeTrue()
    for (const primitive of document
      .getRoot()
      .listMeshes()[0]!
      .listPrimitives()) {
      expect(primitive.getMode()).toBe(Primitive.Mode.TRIANGLES!)
    }
  })

  test("TRIANGLE_FAN primitives are sliced instead of cloned unsliced", async () => {
    // Fan around the origin with one spoke in y- and two in y+.
    const fan = [0, 0, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]
    const { stats, document } = await sliceDocument(
      addModeMesh(Primitive.Mode.TRIANGLE_FAN!, fan, "fan"),
      {
        plane: "xz",
        yOffset: 0,
        side: "y+",
      },
    )

    expect(stats.sourceTriangles).toBe(2)
    expect(stats.surfaceTriangles).toBeGreaterThan(0)
    expect(
      collectWorldPositions(document).every((point) => point[1] >= -1e-5),
    ).toBeTrue()
  })

  test("LINE primitives are still cloned unsliced", async () => {
    const { stats, document } = await sliceDocument(
      addModeMesh(Primitive.Mode.LINES!, [-1, -1, 0, 1, 1, 0], "line"),
      {
        plane: "xz",
        yOffset: 0,
        side: "y+",
      },
    )

    expect(stats.sourceTriangles).toBe(0)
    expect(stats.surfaceTriangles).toBe(0)
    expect(
      collectWorldPositions(document).some((point) => point[1] < -0.5),
    ).toBeTrue()
  })
})
