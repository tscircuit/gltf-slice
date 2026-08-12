import type { Document, JSONDocument } from "@gltf-transform/core"

export type SlicePlane = "xy" | "xz" | "yz"
export type SliceSide = "x+" | "x-" | "y+" | "y-" | "z+" | "z-"
export type Vec3 = [number, number, number]
export type Rgba = [number, number, number, number]

/**
 * Axis-aligned plane syntax. `side` is always the half-space retained in the
 * output. `offset` is accepted for every plane; the axis-specific spelling is
 * provided to make call sites self-documenting.
 */
export type SliceSpec =
  | {
      plane: "xy"
      side: "z+" | "z-"
      offset?: number
      zOffset?: number
    }
  | {
      plane: "xz"
      side: "y+" | "y-"
      offset?: number
      yOffset?: number
    }
  | {
      plane: "yz"
      side: "x+" | "x-"
      offset?: number
      xOffset?: number
    }

export interface HatchTextureOptions {
  /** Square texture size in pixels. Default: 128. */
  size: number
  /** Distance between diagonal hatch lines in pixels. Default: 16. */
  spacing: number
  /** Hatch line width in pixels. Default: 3. */
  lineWidth: number
  /** RGBA fill color, with components in the 0-255 range. */
  background: Rgba
  /** RGBA hatch line color, with components in the 0-255 range. */
  lineColor: Rgba
}

export interface SliceOptions {
  /** Generate a closed interior cap. Default: true. */
  cap?: boolean
  /** World-space tolerance used when clipping and joining cut edges. */
  epsilon?: number
  /** Customize the generated diagonal hatch texture. */
  hatch?: Partial<HatchTextureOptions>
  /** Name assigned to the generated section material. */
  capMaterialName?: string
  /** Mutate the supplied Document instead of cloning it. Default: false. */
  inPlace?: boolean
}

export interface SliceStats {
  nodesVisited: number
  nodesSliced: number
  meshesCreated: number
  sourceTriangles: number
  surfaceTriangles: number
  capTriangles: number
  outputTriangles: number
  capLoops: number
  openChains: number
  removedTriangles: number
}

export interface SliceDocumentResult {
  document: Document
  stats: SliceStats
}

export interface SliceGlbResult {
  glb: Uint8Array
  stats: SliceStats
}

export interface SliceGltfResult {
  gltf: JSONDocument
  stats: SliceStats
}
