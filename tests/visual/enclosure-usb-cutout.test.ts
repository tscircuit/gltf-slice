import { describe, expect, test } from "bun:test"
import { validateBytes } from "gltf-validator"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { sliceGLBWithStats } from "lib/io"

/**
 * This fixture is the debug GLB behind tscircuit/core's
 * enclosure-fdm-box-usb-cutout-simple-3d.snap.png. It was generated from
 * tests/enclosure/enclosure-fdm-box-usb-cutout.test.tsx at core commit
 * 86acb25c1457c57df6dd38a7bbbd07640653f86d.
 */
const ENCLOSURE_GLB = new URL(
  "../fixtures/enclosure-fdm-box-usb-cutout.glb",
  import.meta.url,
)

describe("tscircuit/core enclosure integration", () => {
  test("slices through the USB-C port centerline", async () => {
    const sourceGlb = await Bun.file(ENCLOSURE_GLB).bytes()
    const { glb, stats } = await sliceGLBWithStats(sourceGlb, {
      plane: "yz",
      xOffset: 0,
      side: "x+",
    })

    expect(stats).toMatchObject({
      nodesSliced: 3,
      meshesCreated: 3,
      capLoops: 4,
      openChains: 0,
    })
    expect(stats.capTriangles).toBeGreaterThan(0)
    const validation = await validateBytes(glb, { maxIssues: 100 })
    expect(validation.issues.numErrors).toBe(0)
    expect(validation.issues.numWarnings).toBe(0)

    const png = await renderGLTFToPNGFromGLB(glb, {
      width: 640,
      height: 520,
      supersampling: 2,
      fov: 29,
      ambient: 0.45,
      gamma: true,
      backgroundColor: "#f3f5f8",
      grid: false,
      cull: true,
      camPos: [-28, 16, 37],
      lookAt: [0, 2, 7],
    })

    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      "enclosure-fdm-box-usb-cutout-center-section",
    )
  })
})
