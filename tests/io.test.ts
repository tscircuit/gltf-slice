import { describe, expect, test } from "bun:test"
import { WebIO } from "@gltf-transform/core"
import { validateBytes } from "gltf-validator"
import { sliceGLB, sliceGLBWithStats, sliceGLTF } from "lib/io"
import { createBoxDocument } from "tests/fixtures/create-fixture-document"

describe("in-memory GLB and glTF APIs", () => {
  test("produces a validator-clean GLB", async () => {
    const io = new WebIO()
    const source = await io.writeBinary(createBoxDocument())
    const { glb, stats } = await sliceGLBWithStats(source, {
      plane: "xy",
      zOffset: 0,
      side: "z+",
    })
    expect(glb.slice(0, 4)).toEqual(new Uint8Array([103, 108, 84, 70]))
    expect(stats.capLoops).toBe(1)
    const report = await validateBytes(glb, { maxIssues: 100 })
    expect(report.issues.messages).toEqual([])
    expect(report.issues.numErrors).toBe(0)
    expect((await io.readBinary(glb)).getRoot().listMeshes()).toHaveLength(1)
  })

  test("round-trips JSON glTF resources", async () => {
    const io = new WebIO()
    const source = await io.writeJSON(createBoxDocument())
    const sliced = await sliceGLTF(source, {
      plane: "yz",
      xOffset: 0.2,
      side: "x-",
    })
    expect(Object.keys(sliced.resources).length).toBeGreaterThanOrEqual(2)
    const output = await io.readJSON(sliced)
    expect(output.getRoot().listTextures()).toHaveLength(1)
    expect(output.getRoot().listMeshes()).toHaveLength(1)
  })

  test("sliceGLB returns bytes directly", async () => {
    const io = new WebIO()
    const source = await io.writeBinary(createBoxDocument())
    const output = await sliceGLB(source, {
      plane: "xz",
      yOffset: 0,
      side: "y+",
    })
    expect(output).toBeInstanceOf(Uint8Array)
    expect(output.byteLength).toBeGreaterThan(source.byteLength)
  })
})
