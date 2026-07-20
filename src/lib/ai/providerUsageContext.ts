import { AsyncLocalStorage } from 'node:async_hooks'
import { readOpenAIChatUsage, type OpenAITextUsage } from '@/lib/ai/providerEconomics'

const usageStorage = new AsyncLocalStorage<OpenAITextUsage[]>()

/** Records provider usage only when an API route explicitly opens a collector. */
export function recordOpenAIProviderUsage(rawUsage: unknown): void {
  const store = usageStorage.getStore()
  if (!store) return
  store.push(readOpenAIChatUsage(rawUsage))
}

/**
 * Request-scoped meter for shared/legacy AI adapters. The caller retains the
 * collected calls even if provider output later fails a quality gate.
 */
export function createOpenAIProviderUsageCollector() {
  const calls: OpenAITextUsage[] = []
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      return usageStorage.run(calls, operation)
    },
    snapshot(): OpenAITextUsage[] {
      return calls.map(call => ({ ...call }))
    },
  }
}
