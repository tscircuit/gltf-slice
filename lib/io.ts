import {
  type GLTF,
  type JSONDocument,
  NodeIO,
  WebIO,
} from "@gltf-transform/core"
import { unpartition } from "@gltf-transform/functions"
import { sliceDocument } from "./slice-document"
import type {
  SliceGlbResult,
  SliceGltfResult,
  SliceOptions,
  SliceSpec,
  SliceStats,
} from "./types"

export async function sliceGLBWithStats(
  input: Uint8Array,
  spec: SliceSpec,
  options: SliceOptions = {},
): Promise<SliceGlbResult> {
  const io = new WebIO()
  const source = await io.readBinary(input)
  const { document, stats } = await sliceDocument(source, spec, {
    ...options,
    inPlace: true,
  })
  return { glb: await io.writeBinary(document), stats }
}

export async function sliceGLB(
  input: Uint8Array,
  spec: SliceSpec,
  options: SliceOptions = {},
): Promise<Uint8Array> {
  return (await sliceGLBWithStats(input, spec, options)).glb
}

export async function sliceGLTFWithStats(
  input: JSONDocument | GLTF.IGLTF,
  spec: SliceSpec,
  options: SliceOptions = {},
): Promise<SliceGltfResult> {
  const io = new WebIO()
  const jsonDocument: JSONDocument =
    "json" in input
      ? input
      : {
          json: input,
          resources: {},
        }
  const source = await io.readJSON(jsonDocument)
  const { document, stats } = await sliceDocument(source, spec, {
    ...options,
    inPlace: true,
  })
  return { gltf: await io.writeJSON(document), stats }
}

export async function sliceGLTF(
  input: JSONDocument | GLTF.IGLTF,
  spec: SliceSpec,
  options: SliceOptions = {},
): Promise<JSONDocument> {
  return (await sliceGLTFWithStats(input, spec, options)).gltf
}

/** Reads a .gltf/.glb file and writes either output format based on extension. */
export async function sliceGltfFile(
  inputPath: string,
  outputPath: string,
  spec: SliceSpec,
  options: SliceOptions = {},
): Promise<SliceStats> {
  const [{ mkdir }, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ])
  const outputExtension = path.extname(outputPath).toLowerCase()
  if (outputExtension !== ".glb" && outputExtension !== ".gltf") {
    throw new TypeError("output path must end in .glb or .gltf")
  }
  const io = new NodeIO()
  const source = await io.read(inputPath)
  const { document, stats } = await sliceDocument(source, spec, {
    ...options,
    inPlace: true,
  })
  if (outputExtension === ".glb") await document.transform(unpartition())
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true })
  await io.write(outputPath, document)
  return stats
}
