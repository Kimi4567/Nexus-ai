import { createHash } from 'node:crypto'
import { parseIdempotencyKey } from '@/lib/idempotencyKey.server'

export function parseOwnerCampaignOperationKey(request: Request): string | null {
  return parseIdempotencyKey(request)
}

export function ownerCampaignId(userId: string, operationKey: string): string {
  const digest = createHash('sha256')
    .update(`owner-campaign:v1:${userId}:${operationKey}`)
    .digest('hex')
    .slice(0, 28)
  return `owner_${digest}`
}
