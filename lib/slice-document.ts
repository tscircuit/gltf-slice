import { Logger, type Document, type Material } from "@gltf-transform/core"
import { cloneDocument, prune } from "@gltf-transform/functions"
import { buildCapPrimitive } from "./build-cap-primitive"
import { clipPrimitive } from "./clip-primitive"
import {
  createHatchTexture,
  resolveHatchTextureOptions,
} from "./create-hatch-texture"
import { resolveSlicePlane } from "./resolve-slice-plane"
import type {
  SliceDocumentResult,
  SliceOptions,
  SliceSpec,
  SliceStats,
} from "./types"

function createEmptyStats(): SliceStats {
  return {
    nodesVisited: 0,
    nodesSliced: 0,
    meshesCreated: 0,
    sourceTriangles: 0,
    surfaceTriangles: 0,
    capTriangles: 0,
    outputTriangles: 0,
    capLoops: 0,
    openChains: 0,
    removedTriangles: 0,
  }
}

/**
 * Slices every static mesh instance in a glTF Transform Document. By default the
 * source document is cloned, leaving caller-owned data unchanged.
 */
export async function sliceDocument(
  source: Document,
  spec: SliceSpec,
  options: SliceOptions = {},
): Promise<SliceDocumentResult> {
  const plane = resolveSlicePlane(spec)
  const epsilon = options.epsilon ?? 1e-6
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    throw new TypeError("epsilon must be a finite positive number")
  }
  const hatch = resolveHatchTextureOptions(options.hatch)
  const document = options.inPlace ? source : cloneDocument(source)
  const root = document.getRoot()
  const buffer = root.listBuffers()[0] ?? document.createBuffer("buffer")
  const stats = createEmptyStats()
  let capMaterial: Material | null = null

  const getCapMaterial = (): Material => {
    if (capMaterial) return capMaterial
    const texture = document
      .createTexture("gltf-slice-diagonal-hatch")
      .setImage(createHatchTexture(hatch))
      .setMimeType("image/png")
    capMaterial = document
      .createMaterial(options.capMaterialName ?? "gltf-slice interior")
      .setBaseColorFactor([1, 1, 1, 1])
      .setBaseColorTexture(texture)
      .setMetallicFactor(0)
      .setRoughnessFactor(1)
      .setDoubleSided(true)
      .setExtras({
        gltfSlice: {
          texture: "diagonal-hatch",
          plane: plane.plane,
          side: plane.side,
          offset: plane.offset,
        },
      })
    if (hatch.background[3] < 255 || hatch.lineColor[3] < 255) {
      capMaterial.setAlphaMode("BLEND")
    }
    return capMaterial
  }

  const nodes = [...root.listNodes()]
  for (const node of nodes) {
    stats.nodesVisited += 1
    const sourceMesh = node.getMesh()
    if (!sourceMesh) continue
    if (node.getSkin()) {
      throw new Error(
        `node ${JSON.stringify(node.getName() || "(unnamed)")} uses a skin; bake the deformation before slicing`,
      )
    }

    const worldMatrix = node.getWorldMatrix()
    const outputMesh = sourceMesh.clone()
    for (const primitive of outputMesh.listPrimitives()) {
      outputMesh.removePrimitive(primitive)
    }
    outputMesh.setName(
      `${sourceMesh.getName() || node.getName() || "mesh"} [slice ${plane.plane} ${plane.offset} ${plane.side}]`,
    )

    const segments = []
    for (const primitive of sourceMesh.listPrimitives()) {
      const clipped = clipPrimitive({
        document,
        primitive,
        buffer,
        worldMatrix,
        plane,
        epsilon,
      })
      stats.sourceTriangles += clipped.sourceTriangles
      stats.surfaceTriangles += clipped.surfaceTriangles
      stats.removedTriangles += clipped.removedTriangles
      segments.push(...clipped.segments)
      if (clipped.primitive) outputMesh.addPrimitive(clipped.primitive)
    }

    if (options.cap !== false) {
      const cap = buildCapPrimitive({
        document,
        buffer,
        segments,
        worldMatrix,
        plane,
        epsilon,
        getMaterial: getCapMaterial,
      })
      stats.capTriangles += cap.triangles
      stats.capLoops += cap.loops
      stats.openChains += cap.openChains
      if (cap.primitive) outputMesh.addPrimitive(cap.primitive)
    }

    if (outputMesh.listPrimitives().length === 0) {
      node.setMesh(null)
      outputMesh.dispose()
    } else {
      node.setMesh(outputMesh)
      stats.meshesCreated += 1
    }
    stats.nodesSliced += 1
  }

  stats.outputTriangles = stats.surfaceTriangles + stats.capTriangles
  const asset = root.getAsset()
  asset.generator = asset.generator
    ? `${asset.generator}; gltf-slice`
    : "gltf-slice"

  const logger = document.getLogger()
  document.setLogger(new Logger(Logger.Verbosity.SILENT))
  try {
    await document.transform(
      prune({
        keepAttributes: true,
        keepExtras: true,
        keepLeaves: true,
        keepSolidTextures: true,
      }),
    )
  } finally {
    document.setLogger(logger)
  }

  return { document, stats }
}
