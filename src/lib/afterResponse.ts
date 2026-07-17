import { after } from 'next/server'

/**
 * Small seam around Next.js `after` so background work remains explicit and
 * unit tests can capture and execute the scheduled task deterministically.
 */
export function scheduleAfterResponse(task: () => Promise<void>): void {
  after(task)
}
