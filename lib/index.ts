export {
  createHatchTexture,
  DEFAULT_HATCH_TEXTURE_OPTIONS,
  resolveHatchTextureOptions,
} from "./create-hatch-texture"
export {
  sliceGLB,
  sliceGLBWithStats,
  sliceGLTF,
  sliceGLTFWithStats,
  sliceGltfFile,
} from "./io"
export {
  resolveSlicePlane,
  signedDistanceToSlice,
} from "./resolve-slice-plane"
export { sliceDocument } from "./slice-document"
export type {
  HatchTextureOptions,
  Rgba,
  SliceDocumentResult,
  SliceGlbResult,
  SliceGltfResult,
  SliceOptions,
  SlicePlane,
  SliceSide,
  SliceSpec,
  SliceStats,
  Vec3,
} from "./types"
