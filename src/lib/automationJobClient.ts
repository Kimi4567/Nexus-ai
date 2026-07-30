export type AutomationJobClientStatus =
  | 'PREPARING'
  | 'QUEUED'
  | 'RUNNING'
  | 'RETRY_SCHEDULED'
  | 'WAITING_FOR_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export interface AutomationJobClientRecord {
  id: string
  kind: string
  campaignId: string | null
  status: AutomationJobClientStatus
  progress: number
  currentStep: string | null
  attemptCount: number
  maxAttempts: number
  nextAttemptAt: string
  terminal: boolean
  awaitingApproval: boolean
  canResume: boolean
  message: string | null
  errorCode: string | null
  output: unknown
}

interface WaitForAutomationJobOptions {
  authorization: string
  signal?: AbortSignal
  pollIntervalMs?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>
  now?: () => number
  onProgress?: (job: AutomationJobClientRecord) => void
}

export interface AutomationJobWaitResult {
  job: AutomationJobClientRecord
  timedOut: boolean
}

async function abortableSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    const timer = setTimeout(finish, delayMs)
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

async function readJobResponse(response: Response): Promise<AutomationJobClientRecord> {
  const body = await response.json().catch(() => null) as {
    job?: AutomationJobClientRecord
    error?: string
  } | null
  if (!response.ok || !body?.job) {
    throw new Error(body?.error || `Automation job status failed (${response.status})`)
  }
  return body.job
}

export async function waitForAutomationJob(
  jobId: string,
  options: WaitForAutomationJobOptions,
): Promise<AutomationJobWaitResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? abortableSleep
  const now = options.now ?? Date.now
  const startedAt = now()
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 8 * 60_000)
  const pollIntervalMs = Math.max(250, options.pollIntervalMs ?? 2_500)
  let lastResumeRequestAt = 0
  let latest: AutomationJobClientRecord | null = null

  while (now() - startedAt < timeoutMs) {
    const response = await fetchImpl(`/api/automation/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: { Authorization: options.authorization },
      cache: 'no-store',
      signal: options.signal,
    })
    latest = await readJobResponse(response)
    options.onProgress?.(latest)
    if (latest.terminal || latest.awaitingApproval || latest.status === 'WAITING_FOR_APPROVAL') {
      return { job: latest, timedOut: false }
    }

    const retryDue = latest.canResume
      && Date.parse(latest.nextAttemptAt) <= now()
      && now() - lastResumeRequestAt >= 10_000
    if (retryDue) {
      lastResumeRequestAt = now()
      await fetchImpl(`/api/automation/jobs/${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: { Authorization: options.authorization },
        signal: options.signal,
      }).catch(() => null)
    }

    await sleep(pollIntervalMs, options.signal)
  }

  if (!latest) throw new Error('Automation job status was unavailable.')
  return { job: latest, timedOut: true }
}
