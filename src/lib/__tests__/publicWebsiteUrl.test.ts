import { describe, expect, it } from 'vitest'
import {
  assertPublicWebsiteUrl,
  isPublicIpAddress,
  normalizePublicWebsiteUrl,
} from '@/lib/publicWebsiteUrl'

describe('public website URL safety', () => {
  it('normalizes a public HTTPS hostname and strips fragments', () => {
    expect(normalizePublicWebsiteUrl('nexus.example.co/about#team')).toBe('https://nexus.example.co/about')
  })

  it.each([
    'http://public.example.co',
    'https://localhost/admin',
    'https://127.0.0.1/admin',
    'https://10.0.0.4/metadata',
    'https://169.254.169.254/latest/meta-data',
    'https://user:pass@public.example.co',
    'https://public.example.co:8443',
  ])('rejects unsafe website address %s', value => {
    expect(normalizePublicWebsiteUrl(value)).toBeNull()
  })

  it('distinguishes public and non-public IP ranges', () => {
    expect(isPublicIpAddress('8.8.8.8')).toBe(true)
    expect(isPublicIpAddress('192.168.1.10')).toBe(false)
    expect(isPublicIpAddress('::1')).toBe(false)
    expect(isPublicIpAddress('2606:4700:4700::1111')).toBe(true)
  })

  it('rejects a hostname if DNS includes a private answer', async () => {
    await expect(assertPublicWebsiteUrl('https://public.example.co', async () => [
      { address: '203.0.113.20', family: 4 },
      { address: '10.0.0.8', family: 4 },
    ])).rejects.toThrow('public network')
  })

  it('accepts a hostname only when all DNS answers are public', async () => {
    await expect(assertPublicWebsiteUrl('https://public.example.co', async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ])).resolves.toBe('https://public.example.co/')
  })
})
