import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { NodeIO } from "@gltf-transform/core"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { sliceGltfFile } from "lib/io"
import { createBoxDocument } from "tests/fixtures/create-fixture-document"

describe("file API", () => {
  let directory = ""
  const io = new NodeIO()

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "gltf-slice-test-"))
    await io.write(join(directory, "input.glb"), createBoxDocument())
  })

  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  test("writes GLB output", async () => {
    const outputPath = join(directory, "output.glb")
    const stats = await sliceGltfFile(
      join(directory, "input.glb"),
      outputPath,
      { plane: "xy", zOffset: 0, side: "z+" },
    )
    expect(stats.capLoops).toBe(1)
    const output = await io.read(outputPath)
    expect(output.getRoot().listTextures()).toHaveLength(1)
  })

  test("writes JSON glTF plus external resources", async () => {
    const outputPath = join(directory, "output.gltf")
    await sliceGltfFile(join(directory, "input.glb"), outputPath, {
      plane: "yz",
      xOffset: 0,
      side: "x-",
    })
    const files = await readdir(directory)
    expect(files).toContain("output.gltf")
    expect(files.some((file) => file.endsWith(".bin"))).toBeTrue()
    expect(files.some((file) => file.endsWith(".png"))).toBeTrue()
    const output = await io.read(outputPath)
    expect(output.getRoot().listMeshes()).toHaveLength(1)
  })
})
