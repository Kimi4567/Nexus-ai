import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { getRequestBaseUrl } from '@/lib/requestBaseUrl'

const originalVercelEnv = process.env.VERCEL_ENV
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalVercelEnv
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('getRequestBaseUrl', () => {
  it('keeps preview checkout callbacks on the preview origin', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.nexus-grow.com'
    const req = new NextRequest('https://nexus-preview.example.vercel.app/api/billing/checkout')
    expect(getRequestBaseUrl(req)).toBe('https://nexus-preview.example.vercel.app')
  })

  it('pins production callbacks to the canonical configured domain', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.nexus-grow.com/'
    const req = new NextRequest('https://untrusted-host.example/api/billing/checkout')
    expect(getRequestBaseUrl(req)).toBe('https://www.nexus-grow.com')
  })
})
