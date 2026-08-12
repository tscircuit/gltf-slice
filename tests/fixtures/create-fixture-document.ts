import {
  type Buffer as GltfBuffer,
  Document,
  type Material,
  type Node,
  type Primitive,
  type Scene,
} from "@gltf-transform/core"
import type { Vec3 } from "lib/types"

type Triangle = [Vec3, Vec3, Vec3]

interface FixtureContext {
  document: Document
  scene: Scene
  buffer: GltfBuffer
}

interface AddMeshOptions {
  name?: string
  material?: Material
  translation?: Vec3
  rotation?: [number, number, number, number]
  scale?: Vec3
  parent?: Node
}

export function createFixtureContext(name = "fixture"): FixtureContext {
  const document = new Document()
  const scene = document.createScene(name)
  document.getRoot().setDefaultScene(scene)
  const buffer = document.createBuffer(`${name}-buffer`)
  return { document, scene, buffer }
}

function getDefaultMaterial(document: Document): Material {
  return (
    document
      .getRoot()
      .listMaterials()
      .find((material) => material.getName() === "fixture blue") ??
    document
      .createMaterial("fixture blue")
      .setBaseColorFactor([0.16, 0.42, 0.76, 1])
      .setMetallicFactor(0.05)
      .setRoughnessFactor(0.72)
  )
}

function triangleNormal([a, b, c]: Triangle): Vec3 {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const normal: Vec3 = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ]
  const length = Math.hypot(...normal) || 1
  return [normal[0] / length, normal[1] / length, normal[2] / length]
}

function createTriangleSoupPrimitive(
  context: FixtureContext,
  triangles: Triangle[],
  options: Pick<AddMeshOptions, "name" | "material"> = {},
): Primitive {
  const positions: number[] = []
  const normals: number[] = []
  for (const triangle of triangles) {
    const normal = triangleNormal(triangle)
    for (const point of triangle) {
      positions.push(...point)
      normals.push(...normal)
    }
  }
  const positionAccessor = context.document
    .createAccessor(`${options.name ?? "fixture"}-position`, context.buffer)
    .setType("VEC3")
    .setArray(new Float32Array(positions))
  const normalAccessor = context.document
    .createAccessor(`${options.name ?? "fixture"}-normal`, context.buffer)
    .setType("VEC3")
    .setArray(new Float32Array(normals))
  return context.document
    .createPrimitive()
    .setAttribute("POSITION", positionAccessor)
    .setAttribute("NORMAL", normalAccessor)
    .setMaterial(options.material ?? getDefaultMaterial(context.document))
}

export function addTriangleSoup(
  context: FixtureContext,
  triangles: Triangle[],
  options: AddMeshOptions = {},
): Node {
  const primitive = createTriangleSoupPrimitive(context, triangles, options)
  const mesh = context.document
    .createMesh(options.name ?? "fixture-mesh")
    .addPrimitive(primitive)
  const node = context.document
    .createNode(options.name ?? "fixture-node")
    .setMesh(mesh)
  if (options.translation) node.setTranslation(options.translation)
  if (options.rotation) node.setRotation(options.rotation)
  if (options.scale) node.setScale(options.scale)
  if (options.parent) options.parent.addChild(node)
  else context.scene.addChild(node)
  return node
}

function addQuad(
  triangles: Triangle[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  d: Vec3,
): void {
  triangles.push([a, b, c], [a, c, d])
}

export function createBoxTriangles(size: Vec3 = [2, 2, 2]): Triangle[] {
  const [x, y, z] = [size[0] / 2, size[1] / 2, size[2] / 2]
  const triangles: Triangle[] = []
  addQuad(triangles, [x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z])
  addQuad(triangles, [-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z])
  addQuad(triangles, [-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z])
  addQuad(triangles, [-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z])
  addQuad(triangles, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z])
  addQuad(triangles, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z])
  return triangles
}

export function addBox(
  context: FixtureContext,
  options: AddMeshOptions & { size?: Vec3 } = {},
): Node {
  return addTriangleSoup(context, createBoxTriangles(options.size), options)
}

export function createBoxDocument(
  options: AddMeshOptions & { size?: Vec3 } = {},
): Document {
  const context = createFixtureContext("box")
  addBox(context, { name: "box", ...options })
  return context.document
}

export function createMultiPrimitiveBoxDocument(): Document {
  const context = createFixtureContext("multi-primitive-box")
  const triangles = createBoxTriangles()
  const colors: Array<[number, number, number, number]> = [
    [0.18, 0.45, 0.78, 1],
    [0.16, 0.62, 0.54, 1],
    [0.62, 0.35, 0.72, 1],
    [0.82, 0.43, 0.24, 1],
    [0.76, 0.68, 0.18, 1],
    [0.31, 0.52, 0.69, 1],
  ]
  const mesh = context.document.createMesh("six-face-box")
  for (let face = 0; face < 6; face += 1) {
    const material = context.document
      .createMaterial(`face-${face}`)
      .setBaseColorFactor(colors[face]!)
      .setMetallicFactor(0)
      .setRoughnessFactor(0.75)
    mesh.addPrimitive(
      createTriangleSoupPrimitive(
        context,
        triangles.slice(face * 2, face * 2 + 2),
        { name: `face-${face}`, material },
      ),
    )
  }
  context.scene.addChild(
    context.document.createNode("six-face-box").setMesh(mesh),
  )
  return context.document
}

export function createTubeDocument(): Document {
  const context = createFixtureContext("rectangular-tube")
  const outer: Point2[] = [
    [-2, -2],
    [2, -2],
    [2, 2],
    [-2, 2],
  ]
  const inner: Point2[] = [
    [-0.82, -0.82],
    [0.82, -0.82],
    [0.82, 0.82],
    [-0.82, 0.82],
  ]
  const bottom = -1.4
  const top = 1.4
  const triangles: Triangle[] = []

  for (let index = 0; index < outer.length; index += 1) {
    const next = (index + 1) % outer.length
    const outerA = outer[index]!
    const outerB = outer[next]!
    const innerA = inner[index]!
    const innerB = inner[next]!
    const obA: Vec3 = [outerA[0], outerA[1], bottom]
    const obB: Vec3 = [outerB[0], outerB[1], bottom]
    const otA: Vec3 = [outerA[0], outerA[1], top]
    const otB: Vec3 = [outerB[0], outerB[1], top]
    const ibA: Vec3 = [innerA[0], innerA[1], bottom]
    const ibB: Vec3 = [innerB[0], innerB[1], bottom]
    const itA: Vec3 = [innerA[0], innerA[1], top]
    const itB: Vec3 = [innerB[0], innerB[1], top]
    addQuad(triangles, obA, obB, otB, otA)
    addQuad(triangles, ibA, itA, itB, ibB)
    addQuad(triangles, otA, otB, itB, itA)
    addQuad(triangles, obB, obA, ibA, ibB)
  }

  addTriangleSoup(context, triangles, { name: "rectangular-tube" })
  return context.document
}

export function createCylinderDocument(segments = 32): Document {
  const context = createFixtureContext("cylinder")
  const triangles: Triangle[] = []
  const radius = 1.6
  const bottom = -1.8
  const top = 1.8
  for (let index = 0; index < segments; index += 1) {
    const angleA = (index / segments) * Math.PI * 2
    const angleB = ((index + 1) / segments) * Math.PI * 2
    const aBottom: Vec3 = [
      Math.cos(angleA) * radius,
      Math.sin(angleA) * radius,
      bottom,
    ]
    const bBottom: Vec3 = [
      Math.cos(angleB) * radius,
      Math.sin(angleB) * radius,
      bottom,
    ]
    const aTop: Vec3 = [aBottom[0], aBottom[1], top]
    const bTop: Vec3 = [bBottom[0], bBottom[1], top]
    addQuad(triangles, aBottom, bBottom, bTop, aTop)
    triangles.push([[0, 0, top], aTop, bTop])
    triangles.push([[0, 0, bottom], bBottom, aBottom])
  }
  addTriangleSoup(context, triangles, { name: "cylinder" })
  return context.document
}

type Point2 = [number, number]
