import { type Document, WebIO } from "@gltf-transform/core"
import {
  type RenderGLTFToPNGFromGLBOptions,
  renderGLTFToPNGFromGLB,
} from "poppygl"
import { sliceDocument } from "lib/slice-document"
import type { SliceOptions, SliceSpec } from "lib/types"

export async function renderSlicedDocument(
  document: Document,
  spec: SliceSpec,
  sliceOptions: SliceOptions = {},
  renderOptions: RenderGLTFToPNGFromGLBOptions = {},
): Promise<Uint8Array> {
  const sliced = await sliceDocument(document, spec, sliceOptions)
  const glb = await new WebIO().writeBinary(sliced.document)
  return renderGLTFToPNGFromGLB(glb, {
    width: 420,
    height: 340,
    supersampling: 2,
    fov: 31,
    ambient: 0.42,
    gamma: true,
    backgroundColor: "#f3f5f8",
    grid: false,
    cull: true,
    lookAt: [0, 0, 0],
    ...renderOptions,
  })
}
