export interface GeneratedVisualPollResult {
  id: string
  status: string
  imageUrl?: string | null
  errorMessage?: string | null
}

export class GeneratedVisualStillProcessingError extends Error {
  readonly code = 'GENERATED_VISUAL_STILL_PROCESSING'
}

interface PollGeneratedVisualOptions {
  visualId: string
  authorization: string
  intervalMs?: number
  maxWaitMs?: number
  fetcher?: typeof fetch
}

/**
 * Poll the durable GeneratedVisual job without keeping its billable POST open.
 * Transient read failures do not cancel or duplicate provider production.
 */
export async function pollGeneratedVisual<T extends GeneratedVisualPollResult = GeneratedVisualPollResult>({
  visualId,
  authorization,
  intervalMs = 3_000,
  maxWaitMs = 285_000,
  fetcher = fetch,
}: PollGeneratedVisualOptions): Promise<T> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const response = await fetcher(`/api/visuals/${encodeURIComponent(visualId)}`, {
        headers: { Authorization: authorization },
        cache: 'no-store',
      })
      if (response.ok) {
        const payload = await response.json() as { visual?: T }
        const visual = payload.visual
        if (visual?.status === 'COMPLETED' && visual.imageUrl) return visual
        if (visual?.status === 'FAILED' || visual?.status === 'ARCHIVED') {
          throw new Error(visual.errorMessage || 'NEXUS Image Studio could not create a usable image. Reserved credits were restored.')
        }
      } else if (response.status === 401 || response.status === 404) {
        throw new Error('The image production job is not available in this workspace.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (
        message.includes('could not create a usable image')
        || message.includes('not available in this workspace')
      ) throw error
      // Retry transient polling/network failures; the server job continues.
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new GeneratedVisualStillProcessingError(
    'Image production is still running safely in the background. Refresh the Content Hub shortly; no second charge is needed.',
  )
}
