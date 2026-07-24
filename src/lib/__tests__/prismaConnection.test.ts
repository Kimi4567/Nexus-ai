import { describe, expect, it } from 'vitest'
import { buildPrismaConnectionUrl } from '@/lib/prismaConnection'

describe('buildPrismaConnectionUrl', () => {
  it('removes unsupported statement_timeout without changing local pool settings', () => {
    const result = buildPrismaConnectionUrl(
      'postgresql://user:pass@db.example.com:6543/app?pgbouncer=true&statement_timeout=0',
      false,
    )

    expect(result).toBe('postgresql://user:pass@db.example.com:6543/app?pgbouncer=true')
  })

  it('limits each serverless Prisma pool when operators have not set limits', () => {
    const result = buildPrismaConnectionUrl(
      'postgresql://user:pass@pooler.example.com:6543/app?pgbouncer=true&sslmode=require',
      true,
    )
    const url = new URL(result!)

    expect(url.searchParams.get('connection_limit')).toBe('1')
    expect(url.searchParams.get('pool_timeout')).toBe('10')
    expect(url.searchParams.get('pgbouncer')).toBe('true')
    expect(url.searchParams.get('sslmode')).toBe('require')
  })

  it('preserves explicit operator pool limits', () => {
    const result = buildPrismaConnectionUrl(
      'postgresql://user:pass@pooler.example.com:6543/app?connection_limit=3&pool_timeout=20',
      true,
    )
    const url = new URL(result!)

    expect(url.searchParams.get('connection_limit')).toBe('3')
    expect(url.searchParams.get('pool_timeout')).toBe('20')
  })

  it('returns undefined when DATABASE_URL is absent', () => {
    expect(buildPrismaConnectionUrl('', true)).toBeUndefined()
  })
})
