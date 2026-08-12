import type { Document, mat4 } from "@gltf-transform/core"
import { transformPoint } from "lib/geometry"
import type { Vec3 } from "lib/types"

export function collectWorldPositions(document: Document): Vec3[] {
  const positions: Vec3[] = []
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const matrix = node.getWorldMatrix() as mat4
    for (const primitive of mesh.listPrimitives()) {
      const accessor = primitive.getAttribute("POSITION")
      if (!accessor) continue
      for (let index = 0; index < accessor.getCount(); index += 1) {
        const position: number[] = []
        accessor.getElement(index, position)
        positions.push(transformPoint(matrix, position as Vec3))
      }
    }
  }
  return positions
}
