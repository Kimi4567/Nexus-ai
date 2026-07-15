import { createHash, randomUUID } from 'node:crypto'
import type { CreditAction } from '@/lib/credits'

const IDEMPOTENCY_HEADER = 'idempotency-key'
const VALID_RAW_KEY = /^[a-zA-Z0-9._:-]{8,200}$/

/**
 * Returns a bounded, non-sensitive operation key. A client key makes a network
 * retry replay-safe; an auto key keeps non-upgraded callers unique without
 * accidentally deduplicating intentional regenerations.
 */
export function getCreditOperationKey(
  request: Request,
  action: CreditAction,
  entityType: string,
  entityId: string,
): string {
  // Route unit tests and internal callers may provide a minimal Request-shaped
  // object. Missing headers simply means a unique server-generated operation.
  const supplied = request.headers?.get?.(IDEMPOTENCY_HEADER)?.trim() || ''
  const raw = VALID_RAW_KEY.test(supplied) ? supplied : `auto:${randomUUID()}`
  const digest = createHash('sha256').update(raw).digest('hex').slice(0, 32)
  const scope = `${action}:${entityType}:${entityId}`
    .replace(/[^a-zA-Z0-9:_-]+/g, '-')
    .slice(0, 140)
  return `${scope}:${digest}`
}
