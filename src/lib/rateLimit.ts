/**
 * DEPRECATED — use @/lib/dbRateLimit instead.
 * This file exists only for backward compatibility and re-exports everything
 * from the canonical rate-limiting module.
 */
export type { RateLimitResult, RateLimitOptions } from '@/lib/dbRateLimit'
export { dbRateLimit, aiRateLimit, checkoutRateLimit, authRateLimit, createInMemoryRateLimiter, createRateLimiter } from '@/lib/dbRateLimit'
