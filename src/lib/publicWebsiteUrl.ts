import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

type LookupAddress = { address: string; family: number }
type LookupFn = (hostname: string) => Promise<LookupAddress[]>

function ipv4Parts(value: string): number[] | null {
  const parts = value.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null
  }
  return parts
}

export function isPublicIpAddress(value: string): boolean {
  const family = isIP(value)
  if (family === 4) {
    const parts = ipv4Parts(value)
    if (!parts) return false
    const [a, b] = parts
    return !(
      a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && parts[2] === 100)
      || (a === 203 && b === 0 && parts[2] === 113)
      || a >= 224
    )
  }
  if (family === 6) {
    const normalized = value.toLowerCase().split('%')[0]
    if (normalized.startsWith('::ffff:')) {
      return isPublicIpAddress(normalized.slice('::ffff:'.length))
    }
    return !(
      normalized === '::'
      || normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith('ff')
      || normalized.startsWith('2001:db8:')
    )
  }
  return false
}

function unsafeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return !normalized
    || normalized === 'localhost'
    || normalized === 'metadata.google.internal'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized.endsWith('.test')
    || normalized.endsWith('.invalid')
}

/** Syntactic public-website boundary. DNS is verified separately before fetch. */
export function normalizePublicWebsiteUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`
  try {
    const url = new URL(candidate)
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || (url.port && url.port !== '443')
      || unsafeHostname(url.hostname)
    ) return null
    if (isIP(url.hostname) && !isPublicIpAddress(url.hostname)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Resolves every address before the request. A hostname is rejected if any
 * answer is private/reserved, preventing mixed public/private DNS answers from
 * becoming an internal-network fetch. Redirect targets must call this again.
 */
export async function assertPublicWebsiteUrl(
  value: unknown,
  lookupFn: LookupFn = async hostname => dnsLookup(hostname, { all: true, verbatim: true }),
): Promise<string> {
  const normalized = normalizePublicWebsiteUrl(value)
  if (!normalized) throw new Error('Website must use a public HTTPS address')
  const hostname = new URL(normalized).hostname
  if (isIP(hostname)) return normalized

  const addresses = await lookupFn(hostname)
  if (addresses.length === 0 || addresses.some(item => !isPublicIpAddress(item.address))) {
    throw new Error('Website address did not resolve to a public network')
  }
  return normalized
}
