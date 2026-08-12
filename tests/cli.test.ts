import { describe, expect, test } from "bun:test"
import { parseCliArgs } from "lib/cli"

describe("CLI argument parsing", () => {
  test("parses the documented example", () => {
    expect(
      parseCliArgs([
        "input.glb",
        "output.glb",
        "--plane",
        "xy",
        "--z-offset",
        "10",
        "--side",
        "z+",
      ]),
    ).toMatchObject({
      inputPath: "input.glb",
      outputPath: "output.glb",
      spec: { plane: "xy", zOffset: 10, side: "z+" },
    })
  })

  test("supports cap and hatch controls", () => {
    expect(
      parseCliArgs([
        "input.gltf",
        "output.glb",
        "--plane",
        "yz",
        "--side",
        "x-",
        "--no-cap",
        "--hatch-spacing",
        "20",
      ]),
    ).toMatchObject({ options: { cap: false, hatch: { spacing: 20 } } })
  })

  test("rejects missing values", () => {
    expect(() => parseCliArgs(["input.glb", "output.glb"])).toThrow("--plane")
  })
})
