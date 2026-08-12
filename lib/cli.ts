#!/usr/bin/env bun

import { sliceGltfFile } from "./io"
import type { SliceOptions, SlicePlane, SliceSide, SliceSpec } from "./types"

const HELP = `gltf-slice — create a capped section view from a glTF/GLB model

Usage:
  gltf-slice <input.glb|input.gltf> <output.glb|output.gltf> [options]

Required options:
  --plane <xy|xz|yz>       Axis-aligned cutting plane
  --side <x+|x-|y+|y-|z+|z->
                           Half-space to retain

Offset options (model units; default 0):
  --offset <number>         Generic plane offset
  --x-offset <number>       Offset for a yz plane
  --y-offset <number>       Offset for an xz plane
  --z-offset <number>       Offset for an xy plane

Cap options:
  --no-cap                  Leave the cut surface open
  --hatch-size <pixels>     Hatch texture size (default 128)
  --hatch-spacing <pixels>  Distance between lines (default 16)
  --hatch-line-width <px>   Line width (default 3)
  --epsilon <number>        Geometry tolerance (default 1e-6)
  -h, --help                Show this help

Example:
  gltf-slice model.glb section.glb --plane xy --z-offset 10 --side z+
`

interface ParsedCli {
  inputPath: string
  outputPath: string
  spec: SliceSpec
  options: SliceOptions
}

function parseNumber(value: string | undefined, flag: string): number {
  if (value === undefined) throw new TypeError(`${flag} requires a value`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${flag} must be a finite number`)
  }
  return parsed
}

export function parseCliArgs(args: string[]): ParsedCli | null {
  if (args.includes("--help") || args.includes("-h")) return null
  const positional: string[] = []
  const flags = new Map<string, string>()
  let cap = true

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === "--no-cap") {
      cap = false
      continue
    }
    if (argument.startsWith("--")) {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) {
        throw new TypeError(`${argument} requires a value`)
      }
      flags.set(argument, value)
      index += 1
      continue
    }
    positional.push(argument)
  }

  if (positional.length !== 2) {
    throw new TypeError("expected an input path and an output path")
  }
  const plane = flags.get("--plane") as SlicePlane | undefined
  const side = flags.get("--side") as SliceSide | undefined
  if (!plane || !["xy", "xz", "yz"].includes(plane)) {
    throw new TypeError('--plane must be one of "xy", "xz", or "yz"')
  }
  if (!side) throw new TypeError("--side is required")

  const genericOffset = flags.has("--offset")
    ? parseNumber(flags.get("--offset"), "--offset")
    : undefined
  let spec: SliceSpec
  if (plane === "xy") {
    spec = {
      plane,
      side: side as "z+" | "z-",
      offset: genericOffset,
      zOffset: flags.has("--z-offset")
        ? parseNumber(flags.get("--z-offset"), "--z-offset")
        : undefined,
    }
  } else if (plane === "xz") {
    spec = {
      plane,
      side: side as "y+" | "y-",
      offset: genericOffset,
      yOffset: flags.has("--y-offset")
        ? parseNumber(flags.get("--y-offset"), "--y-offset")
        : undefined,
    }
  } else {
    spec = {
      plane,
      side: side as "x+" | "x-",
      offset: genericOffset,
      xOffset: flags.has("--x-offset")
        ? parseNumber(flags.get("--x-offset"), "--x-offset")
        : undefined,
    }
  }

  const hatch: SliceOptions["hatch"] = {}
  if (flags.has("--hatch-size")) {
    hatch.size = parseNumber(flags.get("--hatch-size"), "--hatch-size")
  }
  if (flags.has("--hatch-spacing")) {
    hatch.spacing = parseNumber(flags.get("--hatch-spacing"), "--hatch-spacing")
  }
  if (flags.has("--hatch-line-width")) {
    hatch.lineWidth = parseNumber(
      flags.get("--hatch-line-width"),
      "--hatch-line-width",
    )
  }
  const options: SliceOptions = {
    cap,
    hatch,
    epsilon: flags.has("--epsilon")
      ? parseNumber(flags.get("--epsilon"), "--epsilon")
      : undefined,
  }

  return {
    inputPath: positional[0]!,
    outputPath: positional[1]!,
    spec,
    options,
  }
}

export async function runCLI(args = Bun.argv.slice(2)): Promise<void> {
  const parsed = parseCliArgs(args)
  if (!parsed) {
    console.log(HELP)
    return
  }
  const stats = await sliceGltfFile(
    parsed.inputPath,
    parsed.outputPath,
    parsed.spec,
    parsed.options,
  )
  console.log(
    `Wrote ${parsed.outputPath}: ${stats.surfaceTriangles} surface triangles + ${stats.capTriangles} cap triangles across ${stats.capLoops} loop(s)`,
  )
}

if (import.meta.main) {
  runCLI().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    console.error("\nRun gltf-slice --help for usage.")
    process.exitCode = 1
  })
}
