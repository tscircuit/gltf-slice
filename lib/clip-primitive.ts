import {
  type Buffer as GltfBuffer,
  type Document,
  Primitive,
  type mat4,
} from "@gltf-transform/core"
import {
  dot,
  interpolate,
  normalizeAttribute,
  squaredDistance,
  transformPoint,
  triangleNormal,
} from "./geometry"
import {
  type ResolvedSlicePlane,
  signedDistanceToSlice,
  snapPointToSlice,
} from "./resolve-slice-plane"
import type { Vec3 } from "./types"

interface Vertex {
  attributes: Map<string, number[]>
  localPosition: Vec3
  worldPosition: Vec3
  distance: number
}

export interface CutSegment {
  a: Vec3
  b: Vec3
}

export interface ClipPrimitiveResult {
  primitive: Primitive | null
  segments: CutSegment[]
  sourceTriangles: number
  surfaceTriangles: number
  removedTriangles: number
}

interface ClipPrimitiveOptions {
  document: Document
  primitive: Primitive
  buffer: GltfBuffer
  worldMatrix: mat4
  plane: ResolvedSlicePlane
  epsilon: number
}

function mixVertex(a: Vertex, b: Vertex): Vertex {
  const denominator = a.distance - b.distance
  const rawT = denominator === 0 ? 0.5 : a.distance / denominator
  const t = Math.max(0, Math.min(1, rawT))
  const attributes = new Map<string, number[]>()
  for (const [semantic, value] of a.attributes) {
    attributes.set(
      semantic,
      normalizeAttribute(
        semantic,
        interpolate(value, b.attributes.get(semantic) ?? value, t),
      ),
    )
  }
  const localPosition = attributes.get("POSITION") as Vec3
  const worldPosition: Vec3 = [
    a.worldPosition[0] + (b.worldPosition[0] - a.worldPosition[0]) * t,
    a.worldPosition[1] + (b.worldPosition[1] - a.worldPosition[1]) * t,
    a.worldPosition[2] + (b.worldPosition[2] - a.worldPosition[2]) * t,
  ]
  return {
    attributes,
    localPosition,
    worldPosition,
    distance: 0,
  }
}

function removeDuplicatePolygonVertices(
  polygon: Vertex[],
  epsilon: number,
): Vertex[] {
  const result: Vertex[] = []
  const epsilonSquared = epsilon * epsilon
  for (const vertex of polygon) {
    const previous = result.at(-1)
    if (
      !previous ||
      squaredDistance(previous.worldPosition, vertex.worldPosition) >
        epsilonSquared
    ) {
      result.push(vertex)
    }
  }
  if (
    result.length > 1 &&
    squaredDistance(result[0]!.worldPosition, result.at(-1)!.worldPosition) <=
      epsilonSquared
  ) {
    result.pop()
  }
  return result
}

function clipTriangle(triangle: Vertex[], epsilon: number): Vertex[] {
  const output: Vertex[] = []
  let previous = triangle.at(-1)!
  let previousInside = previous.distance >= -epsilon

  for (const current of triangle) {
    const currentInside = current.distance >= -epsilon
    if (currentInside) {
      if (!previousInside) output.push(mixVertex(previous, current))
      output.push(current)
    } else if (previousInside) {
      output.push(mixVertex(previous, current))
    }
    previous = current
    previousInside = currentInside
  }

  return removeDuplicatePolygonVertices(output, epsilon)
}

function addUniquePoint(points: Vec3[], point: Vec3, epsilon: number): void {
  const epsilonSquared = epsilon * epsilon
  if (
    points.every(
      (candidate) => squaredDistance(candidate, point) > epsilonSquared,
    )
  ) {
    points.push(point)
  }
}

function getTriangleCutSegment(
  triangle: Vertex[],
  plane: ResolvedSlicePlane,
  epsilon: number,
): CutSegment | null {
  if (triangle.every((vertex) => Math.abs(vertex.distance) <= epsilon)) {
    return null
  }

  const points: Vec3[] = []
  for (let index = 0; index < triangle.length; index += 1) {
    const a = triangle[index]!
    const b = triangle[(index + 1) % triangle.length]!
    if (Math.abs(a.distance) <= epsilon) {
      addUniquePoint(points, snapPointToSlice(a.worldPosition, plane), epsilon)
    }
    if (
      (a.distance > epsilon && b.distance < -epsilon) ||
      (a.distance < -epsilon && b.distance > epsilon)
    ) {
      const mixed = mixVertex(a, b)
      addUniquePoint(
        points,
        snapPointToSlice(mixed.worldPosition, plane),
        epsilon,
      )
    }
  }

  if (
    points.length !== 2 ||
    squaredDistance(points[0]!, points[1]!) <= epsilon * epsilon
  ) {
    return null
  }
  return { a: points[0]!, b: points[1]! }
}

function isDegenerateTriangle(
  a: Vertex,
  b: Vertex,
  c: Vertex,
  epsilon: number,
): boolean {
  const normal = triangleNormal(
    a.worldPosition,
    b.worldPosition,
    c.worldPosition,
  )
  return dot(normal, normal) <= epsilon ** 4
}

export function clipPrimitive({
  document,
  primitive,
  buffer,
  worldMatrix,
  plane,
  epsilon,
}: ClipPrimitiveOptions): ClipPrimitiveResult {
  if (primitive.getMode() !== Primitive.Mode.TRIANGLES) {
    return {
      primitive: primitive.clone(),
      segments: [],
      sourceTriangles: 0,
      surfaceTriangles: 0,
      removedTriangles: 0,
    }
  }
  if (primitive.listTargets().length > 0) {
    throw new Error("morph target primitives are not supported")
  }

  const positionAccessor = primitive.getAttribute("POSITION")
  if (positionAccessor?.getElementSize() !== 3) {
    throw new Error("triangle primitives must have a VEC3 POSITION attribute")
  }

  const semantics = primitive.listSemantics()
  if (semantics.some((semantic) => semantic.startsWith("JOINTS_"))) {
    throw new Error("skinned vertex attributes are not supported")
  }
  const accessors = semantics.map((semantic) => {
    const accessor = primitive.getAttribute(semantic)!
    if (accessor.getCount() !== positionAccessor.getCount()) {
      throw new Error(`attribute ${semantic} has a mismatched vertex count`)
    }
    return { semantic, accessor }
  })

  const sourceVertexCache = new Map<number, Vertex>()
  const getVertex = (index: number): Vertex => {
    const cached = sourceVertexCache.get(index)
    if (cached) return cached
    const attributes = new Map<string, number[]>()
    for (const { semantic, accessor } of accessors) {
      attributes.set(semantic, accessor.getElement(index, []))
    }
    const localPosition = attributes.get("POSITION") as Vec3
    const worldPosition = transformPoint(worldMatrix, localPosition)
    const vertex: Vertex = {
      attributes,
      localPosition,
      worldPosition,
      distance: signedDistanceToSlice(worldPosition, plane),
    }
    sourceVertexCache.set(index, vertex)
    return vertex
  }

  const indices = primitive.getIndices()
  const indexCount = indices?.getCount() ?? positionAccessor.getCount()
  if (indexCount % 3 !== 0) {
    throw new Error(
      "triangle primitive vertex/index count must be divisible by 3",
    )
  }
  const getIndex = (index: number): number =>
    indices ? indices.getScalar(index) : index

  const outputAttributes = new Map<string, number[]>()
  for (const semantic of semantics) outputAttributes.set(semantic, [])
  const segments: CutSegment[] = []
  let surfaceTriangles = 0
  let removedTriangles = 0

  const appendVertex = (vertex: Vertex): void => {
    for (const semantic of semantics) {
      const target = outputAttributes.get(semantic)!
      const value = normalizeAttribute(semantic, [
        ...(vertex.attributes.get(semantic) ?? []),
      ])
      target.push(...value)
    }
  }

  for (let index = 0; index < indexCount; index += 3) {
    const triangle = [
      getVertex(getIndex(index)),
      getVertex(getIndex(index + 1)),
      getVertex(getIndex(index + 2)),
    ]
    const segment = getTriangleCutSegment(triangle, plane, epsilon)
    if (segment) segments.push(segment)

    const polygon = clipTriangle(triangle, epsilon)
    if (polygon.length < 3) {
      removedTriangles += 1
      continue
    }

    let triangleOutputCount = 0
    for (let fanIndex = 1; fanIndex < polygon.length - 1; fanIndex += 1) {
      const a = polygon[0]!
      const b = polygon[fanIndex]!
      const c = polygon[fanIndex + 1]!
      if (isDegenerateTriangle(a, b, c, epsilon)) continue
      appendVertex(a)
      appendVertex(b)
      appendVertex(c)
      surfaceTriangles += 1
      triangleOutputCount += 1
    }
    if (triangleOutputCount === 0) removedTriangles += 1
  }

  if (surfaceTriangles === 0) {
    return {
      primitive: null,
      segments,
      sourceTriangles: indexCount / 3,
      surfaceTriangles,
      removedTriangles,
    }
  }

  const outputPrimitive = primitive.clone().setIndices(null)
  for (const semantic of semantics) outputPrimitive.setAttribute(semantic, null)
  for (const { semantic, accessor } of accessors) {
    const outputAccessor = document
      .createAccessor(`${accessor.getName() || semantic}-slice`, buffer)
      .setType(accessor.getType())
      .setArray(new Float32Array(outputAttributes.get(semantic)!))
    outputPrimitive.setAttribute(semantic, outputAccessor)
  }

  return {
    primitive: outputPrimitive,
    segments,
    sourceTriangles: indexCount / 3,
    surfaceTriangles,
    removedTriangles,
  }
}
