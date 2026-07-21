export class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message)
    this.name = 'RequestTimeoutError'
  }
}

// Customer-facing reads often fan out across auth, database, and provider
// boundaries. A short 6-9s deadline made normal cold starts look like missing
// product data. Keep one explicit budget for interactive product reads; server
// jobs and third-party crawlers still own their tighter, operation-specific
// deadlines.
export const PRODUCT_READ_TIMEOUT_MS = 15_000

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = PRODUCT_READ_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
