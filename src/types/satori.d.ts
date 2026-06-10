/**
 * Minimal type stub for `satori` — allows TypeScript to compile without
 * satori being installed locally. The real package is listed in package.json
 * and will be installed by Vercel on deploy.
 *
 * satori: Vercel's JSX→SVG engine used for Arabic typography rendering.
 * Full types ship with the package once installed.
 */
declare module 'satori' {
  export interface SatoriOptions {
    width: number
    height: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fonts: Array<{
      name: string
      data: ArrayBuffer
      weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
      style?: 'normal' | 'italic'
    }>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function satori(element: any, options: SatoriOptions): Promise<string>
  export default satori
}
