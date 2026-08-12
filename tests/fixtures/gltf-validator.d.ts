declare module "gltf-validator" {
  interface ValidationReport {
    issues: {
      numErrors: number
      numWarnings: number
      numInfos: number
      numHints: number
      messages: Array<{ code: string; message: string; severity: number }>
    }
  }

  export function validateBytes(
    data: Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<ValidationReport>
}
