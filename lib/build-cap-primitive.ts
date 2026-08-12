import type {
  Buffer as GltfBuffer,
  Document,
  Material,
  Primitive,
  mat4,
} from "@gltf-transform/core"
import earcut from "earcut"
import {
  dot,
  invertMatrix,
  transformPoint,
  triangleNormal,
  worldNormalToLocal,
} from "./geometry"
import type { CutSegment } from "./clip-primitive"
import {
  type ResolvedSlicePlane,
  projectPointToSlice,
  unprojectPointFromSlice,
} from "./resolve-slice-plane"

type Point2 = [number, number]

interface GraphEdge {
  id: number
  a: string
  b: string
}

interface LoopInfo {
  points: Point2[]
  area: number
  absoluteArea: number
  parent: LoopInfo | null
  depth: number
}

export interface BuildCapResult {
  primitive: Primitive | null
  loops: number
  triangles: number
  openChains: number
}

interface BuildCapOptions {
  document: Document
  buffer: GltfBuffer
  segments: CutSegment[]
  worldMatrix: mat4
  plane: ResolvedSlicePlane
  epsilon: number
  getMaterial: () => Material
}

function pointKey(point: Point2, epsilon: number): string {
  return `${Math.round(point[0] / epsilon)},${Math.round(point[1] / epsilon)}`
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function otherEndpoint(edge: GraphEdge, endpoint: string): string {
  return edge.a === endpoint ? edge.b : edge.a
}

function selectContinuation(
  previous: string,
  current: string,
  candidateIds: number[],
  edges: GraphEdge[],
  points: Map<string, Point2>,
): number {
  if (candidateIds.length === 1) return candidateIds[0]!
  const previousPoint = points.get(previous)!
  const currentPoint = points.get(current)!
  const incoming: Point2 = [
    currentPoint[0] - previousPoint[0],
    currentPoint[1] - previousPoint[1],
  ]
  const incomingLength = Math.hypot(incoming[0], incoming[1]) || 1
  let bestId = candidateIds[0]!
  let bestScore = -Infinity
  for (const candidateId of candidateIds) {
    const candidate = edges[candidateId]!
    const nextPoint = points.get(otherEndpoint(candidate, current))!
    const outgoing: Point2 = [
      nextPoint[0] - currentPoint[0],
      nextPoint[1] - currentPoint[1],
    ]
    const outgoingLength = Math.hypot(outgoing[0], outgoing[1]) || 1
    const score =
      (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) /
      (incomingLength * outgoingLength)
    if (score > bestScore) {
      bestScore = score
      bestId = candidateId
    }
  }
  return bestId
}

function walkLoops(
  edges: GraphEdge[],
  adjacency: Map<string, number[]>,
  points: Map<string, Point2>,
): { loops: string[][]; openChains: number } {
  const unused = new Set(edges.map((edge) => edge.id))
  const loops: string[][] = []
  let openChains = 0

  while (unused.size > 0) {
    const firstId = unused.values().next().value as number
    const first = edges[firstId]!
    unused.delete(firstId)
    const path = [first.a, first.b]
    const start = first.a
    let previous = first.a
    let current = first.b
    let closed = current === start

    for (let steps = 0; !closed && steps <= edges.length; steps += 1) {
      const candidates = (adjacency.get(current) ?? []).filter((id) =>
        unused.has(id),
      )
      if (candidates.length === 0) break
      const nextId = selectContinuation(
        previous,
        current,
        candidates,
        edges,
        points,
      )
      unused.delete(nextId)
      const next = otherEndpoint(edges[nextId]!, current)
      previous = current
      current = next
      closed = current === start
      if (!closed) path.push(current)
    }

    if (closed && path.length >= 3) loops.push(path)
    else openChains += 1
  }

  return { loops, openChains }
}

function signedArea(points: Point2[]): number {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    area += current[0] * next[1] - next[0] * current[1]
  }
  return area / 2
}

function removeCollinearPoints(points: Point2[], epsilon: number): Point2[] {
  const simplified = [...points]
  let changed = true
  while (changed && simplified.length > 3) {
    changed = false
    for (let index = 0; index < simplified.length; index += 1) {
      const previous =
        simplified[(index - 1 + simplified.length) % simplified.length]!
      const current = simplified[index]!
      const next = simplified[(index + 1) % simplified.length]!
      const ax = current[0] - previous[0]
      const ay = current[1] - previous[1]
      const bx = next[0] - current[0]
      const by = next[1] - current[1]
      const cross = Math.abs(ax * by - ay * bx)
      const scale = Math.hypot(ax, ay) + Math.hypot(bx, by)
      if (cross <= epsilon * Math.max(1, scale) && ax * bx + ay * by >= 0) {
        simplified.splice(index, 1)
        changed = true
        break
      }
    }
  }
  return simplified
}

function pointInPolygon(point: Point2, polygon: Point2[]): boolean {
  let inside = false
  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex]!
    const previous = polygon[previousIndex]!
    const crosses =
      current[1] > point[1] !== previous[1] > point[1] &&
      point[0] <
        ((previous[0] - current[0]) * (point[1] - current[1])) /
          (previous[1] - current[1]) +
          current[0]
    if (crosses) inside = !inside
  }
  return inside
}

function classifyLoops(rawLoops: Point2[][], epsilon: number): LoopInfo[] {
  const loops = rawLoops
    .map((points) => removeCollinearPoints(points, epsilon))
    .map<LoopInfo>((points) => {
      const area = signedArea(points)
      return {
        points,
        area,
        absoluteArea: Math.abs(area),
        parent: null,
        depth: 0,
      }
    })
    .filter((loop) => loop.absoluteArea > epsilon * epsilon)
    .sort((a, b) => b.absoluteArea - a.absoluteArea)

  for (let index = 0; index < loops.length; index += 1) {
    const loop = loops[index]!
    let parent: LoopInfo | null = null
    for (let candidateIndex = 0; candidateIndex < index; candidateIndex += 1) {
      const candidate = loops[candidateIndex]!
      if (
        pointInPolygon(loop.points[0]!, candidate.points) &&
        (!parent || candidate.absoluteArea < parent.absoluteArea)
      ) {
        parent = candidate
      }
    }
    loop.parent = parent
    loop.depth = parent ? parent.depth + 1 : 0
  }
  return loops
}

function buildSegmentGraph(
  segments: CutSegment[],
  plane: ResolvedSlicePlane,
  epsilon: number,
): {
  points: Map<string, Point2>
  edges: GraphEdge[]
  adjacency: Map<string, number[]>
} {
  const points = new Map<string, Point2>()
  const edgeKeys = new Set<string>()
  const edges: GraphEdge[] = []
  const adjacency = new Map<string, number[]>()

  for (const segment of segments) {
    const pointA = projectPointToSlice(segment.a, plane)
    const pointB = projectPointToSlice(segment.b, plane)
    const a = pointKey(pointA, epsilon)
    const b = pointKey(pointB, epsilon)
    if (a === b) continue
    const key = edgeKey(a, b)
    if (edgeKeys.has(key)) continue
    edgeKeys.add(key)
    points.set(a, points.get(a) ?? pointA)
    points.set(b, points.get(b) ?? pointB)
    const edge: GraphEdge = { id: edges.length, a, b }
    edges.push(edge)
    adjacency.set(a, [...(adjacency.get(a) ?? []), edge.id])
    adjacency.set(b, [...(adjacency.get(b) ?? []), edge.id])
  }

  return { points, edges, adjacency }
}

export function buildCapPrimitive({
  document,
  buffer,
  segments,
  worldMatrix,
  plane,
  epsilon,
  getMaterial,
}: BuildCapOptions): BuildCapResult {
  if (segments.length === 0) {
    return { primitive: null, loops: 0, triangles: 0, openChains: 0 }
  }

  const graph = buildSegmentGraph(segments, plane, epsilon)
  const walked = walkLoops(graph.edges, graph.adjacency, graph.points)
  const rawLoops = walked.loops.map((loop) =>
    loop.map((key) => graph.points.get(key)!),
  )
  const loops = classifyLoops(rawLoops, epsilon)
  if (loops.length === 0) {
    return {
      primitive: null,
      loops: 0,
      triangles: 0,
      openChains: walked.openChains,
    }
  }

  const allPoints = loops.flatMap((loop) => loop.points)
  const minU = Math.min(...allPoints.map((point) => point[0]))
  const maxU = Math.max(...allPoints.map((point) => point[0]))
  const minV = Math.min(...allPoints.map((point) => point[1]))
  const maxV = Math.max(...allPoints.map((point) => point[1]))
  const width = maxU - minU || 1
  const height = maxV - minV || 1

  const inverseWorldMatrix = invertMatrix(worldMatrix)
  const localNormal = worldNormalToLocal(worldMatrix, plane.capNormal)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (const outer of loops.filter((loop) => loop.depth % 2 === 0)) {
    const holes = loops.filter(
      (loop) => loop.parent === outer && loop.depth === outer.depth + 1,
    )
    const groupLoops = [outer, ...holes]
    const flatPoints: Point2[] = []
    const flattened: number[] = []
    const holeIndices: number[] = []
    for (let loopIndex = 0; loopIndex < groupLoops.length; loopIndex += 1) {
      if (loopIndex > 0) holeIndices.push(flatPoints.length)
      for (const point of groupLoops[loopIndex]!.points) {
        flatPoints.push(point)
        flattened.push(point[0], point[1])
      }
    }

    const triangleIndices = earcut(flattened, holeIndices, 2)
    const baseIndex = positions.length / 3
    const worldPoints = flatPoints.map((point) =>
      unprojectPointFromSlice(point, plane),
    )
    for (let index = 0; index < flatPoints.length; index += 1) {
      const point = flatPoints[index]!
      const local = transformPoint(inverseWorldMatrix, worldPoints[index]!)
      positions.push(...local)
      normals.push(...localNormal)
      uvs.push((point[0] - minU) / width, 1 - (point[1] - minV) / height)
    }

    for (let index = 0; index < triangleIndices.length; index += 3) {
      const a = triangleIndices[index]!
      let b = triangleIndices[index + 1]!
      let c = triangleIndices[index + 2]!
      const normal = triangleNormal(
        worldPoints[a]!,
        worldPoints[b]!,
        worldPoints[c]!,
      )
      if (dot(normal, plane.capNormal) < 0) {
        const swap = b
        b = c
        c = swap
      }
      indices.push(baseIndex + a, baseIndex + b, baseIndex + c)
    }
  }

  if (indices.length === 0) {
    return {
      primitive: null,
      loops: loops.length,
      triangles: 0,
      openChains: walked.openChains,
    }
  }

  const positionAccessor = document
    .createAccessor("gltf-slice-cap-position", buffer)
    .setType("VEC3")
    .setArray(new Float32Array(positions))
  const normalAccessor = document
    .createAccessor("gltf-slice-cap-normal", buffer)
    .setType("VEC3")
    .setArray(new Float32Array(normals))
  const uvAccessor = document
    .createAccessor("gltf-slice-cap-uv", buffer)
    .setType("VEC2")
    .setArray(new Float32Array(uvs))
  const indexAccessor = document
    .createAccessor("gltf-slice-cap-indices", buffer)
    .setType("SCALAR")
    .setArray(new Uint32Array(indices))
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", positionAccessor)
    .setAttribute("NORMAL", normalAccessor)
    .setAttribute("TEXCOORD_0", uvAccessor)
    .setIndices(indexAccessor)
    .setMaterial(getMaterial())

  return {
    primitive,
    loops: loops.length,
    triangles: indices.length / 3,
    openChains: walked.openChains,
  }
}
