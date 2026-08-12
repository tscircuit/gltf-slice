import { encode } from "fast-png"
import type { HatchTextureOptions, Rgba } from "./types"

export const DEFAULT_HATCH_TEXTURE_OPTIONS: HatchTextureOptions = {
  size: 128,
  spacing: 16,
  lineWidth: 3,
  background: [255, 214, 102, 255],
  lineColor: [52, 49, 45, 255],
}

function validateColor(color: Rgba, name: string): void {
  if (
    color.length !== 4 ||
    color.some(
      (component) =>
        !Number.isInteger(component) || component < 0 || component > 255,
    )
  ) {
    throw new TypeError(
      `${name} must contain four integer values from 0 to 255`,
    )
  }
}

export function resolveHatchTextureOptions(
  options: Partial<HatchTextureOptions> = {},
): HatchTextureOptions {
  const resolved: HatchTextureOptions = {
    ...DEFAULT_HATCH_TEXTURE_OPTIONS,
    ...options,
    background: options.background
      ? [...options.background]
      : [...DEFAULT_HATCH_TEXTURE_OPTIONS.background],
    lineColor: options.lineColor
      ? [...options.lineColor]
      : [...DEFAULT_HATCH_TEXTURE_OPTIONS.lineColor],
  }

  if (!Number.isInteger(resolved.size) || resolved.size < 8) {
    throw new TypeError("hatch size must be an integer of at least 8 pixels")
  }
  if (!Number.isInteger(resolved.spacing) || resolved.spacing < 2) {
    throw new TypeError("hatch spacing must be an integer of at least 2 pixels")
  }
  if (
    !Number.isInteger(resolved.lineWidth) ||
    resolved.lineWidth < 1 ||
    resolved.lineWidth >= resolved.spacing
  ) {
    throw new TypeError(
      "hatch lineWidth must be a positive integer smaller than spacing",
    )
  }
  validateColor(resolved.background, "hatch background")
  validateColor(resolved.lineColor, "hatch lineColor")
  return resolved
}

/** Creates a repeatable 45-degree diagonal hatch as an RGBA PNG. */
export function createHatchTexture(
  options: Partial<HatchTextureOptions> = {},
): Uint8Array {
  const resolved = resolveHatchTextureOptions(options)
  const pixels = new Uint8Array(resolved.size * resolved.size * 4)

  for (let y = 0; y < resolved.size; y += 1) {
    for (let x = 0; x < resolved.size; x += 1) {
      const diagonal =
        (x + (resolved.size - 1 - y)) % resolved.spacing < resolved.lineWidth
      const color = diagonal ? resolved.lineColor : resolved.background
      const offset = (y * resolved.size + x) * 4
      pixels[offset] = color[0]
      pixels[offset + 1] = color[1]
      pixels[offset + 2] = color[2]
      pixels[offset + 3] = color[3]
    }
  }

  return encode({
    width: resolved.size,
    height: resolved.size,
    data: pixels,
    channels: 4,
    depth: 8,
  })
}
