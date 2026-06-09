/**
 * Minimal Sharp type stub.
 * Replace by running: npm install sharp @types/sharp
 * After install, delete this file — the real @types/sharp will be used.
 */
declare module 'sharp' {
  interface Sharp {
    resize(width?: number, height?: number, options?: {
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
      position?: string | number
      background?: { r: number; g: number; b: number; alpha: number } | string
    }): Sharp
    composite(layers: OverlayOptions[]): Sharp
    jpeg(options?: { quality?: number; progressive?: boolean }): Sharp
    png(options?: Record<string, unknown>): Sharp
    toBuffer(): Promise<Buffer>
  }

  namespace sharp {
    interface OverlayOptions {
      input?: Buffer | string
      top?: number
      left?: number
      gravity?: string
      blend?: string
      premultiplied?: boolean
      tile?: boolean
    }
  }
  function sharp(input?: Buffer | string): Sharp
  export = sharp
}
