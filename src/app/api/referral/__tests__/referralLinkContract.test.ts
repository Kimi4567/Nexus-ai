import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/referral/route.ts'), 'utf8')

describe('referral link contract', () => {
  it('targets the real registration route and preserves the request origin', () => {
    expect(source).toContain('getRequestBaseUrl(req)')
    expect(source).toContain('/auth/register?ref=')
    expect(source).not.toContain('`${baseUrl}/register?ref=')
  })
})
