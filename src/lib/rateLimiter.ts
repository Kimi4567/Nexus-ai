/**
 * DEPRECATED — use @/lib/dbRateLimit instead.
 * This file exists only for backward compatibility and re-exports everything
 * from the canonical rate-limiting module.
 */
export type { RateLimitResult, RateLimitOptions as RateLimiterOptions } from '@/lib/dbRateLimit'
export { createInMemoryRateLimiter, createRateLimiter } from '@/lib/dbRateLimit'
