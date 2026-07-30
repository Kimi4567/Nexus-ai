import { createHash, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { prisma } from '@/lib/prisma'

const db = prisma as any // Prisma is regenerated after the additive production migration.
const USER_AGENT = 'NexusCompetitorMonitor/1.0 (+https://www.nexus-grow.com)'
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_REDIRECTS = 3
const DEFAULT_CADENCE_HOURS = 24

class CompetitorContextChangedError extends Error {
  constructor() {
    super('Brand context review is required before monitoring can continue.')
    this.name = 'CompetitorContextChangedError'
  }
}

export interface PageEvidence {
  title: string
  description: string
  headings: string[]
  prices: string[]
  callsToAction: string[]
  normalizedText: string
}

export interface ChangeClassification {
  type: 'PRICE_CHANGE' | 'OFFER_CHANGE' | 'CTA_CHANGE' | 'MESSAGE_CHANGE' | 'PAGE_CHANGE'
  title: string
  summary: string
  beforeText: string
  afterText: string
  confidence: number
  importance: number
}

export interface CompetitorScanResult {
  sourceId: string
  checked: boolean
  baselineCreated: boolean
  changed: boolean
  signalCreated: boolean
  statusCode?: number
  error?: string
}

function cleanText(value: string, max = 500): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
    .slice(0, max)
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase()
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return named[lower] ?? match
  })
}

function tagText(html: string, tagPattern: string, limit: number, maxLength = 220): string[] {
  const values: string[] = []
  const seen = new Set<string>()
  const expression = new RegExp(`<(?:${tagPattern})\\b[^>]*>([\\s\\S]*?)<\\/(?:${tagPattern})>`, 'gi')
  for (const match of html.matchAll(expression)) {
    const value = cleanText(decodeHtml(match[1].replace(/<[^>]+>/g, ' ')), maxLength)
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    values.push(value)
    if (values.length >= limit) break
  }
  return values
}

function metaContent(html: string, name: string): string {
  const expressions = [
    new RegExp(`<meta\\b[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`, 'i'),
  ]
  for (const expression of expressions) {
    const match = html.match(expression)
    if (match?.[1]) return cleanText(decodeHtml(match[1]), 500)
  }
  return ''
}

export function extractPageEvidence(html: string): PageEvidence {
  const stableHtml = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
  const title = tagText(stableHtml, 'title', 1, 300)[0] ?? ''
  const description = metaContent(stableHtml, 'description') || metaContent(stableHtml, 'og:description')
  const headings = tagText(stableHtml, 'h[1-3]', 30)
  const callsToAction = tagText(stableHtml, 'button|a', 80, 100)
    .filter(value => /^(buy|shop|order|get|start|book|subscribe|join|contact|learn|discover|view|explore|اشتر|اطلب|ابدأ|احجز|اشترك|تواصل|اعرف|اكتشف)/i.test(value))
    .slice(0, 20)
  const visibleText = cleanText(
    decodeHtml(
      stableHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|section|article|header|footer)>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    ),
    20_000,
  )
  const pricePattern = /(?:AED|USD|EUR|GBP|د\.?\s?إ|£|\$|€)\s?\d[\d,.]*(?:\s?(?:\/|per)\s?(?:month|mo|year|yr))?|\d[\d,.]*\s?(?:AED|USD|EUR|GBP|د\.?\s?إ)/gi
  const prices = Array.from(new Set((visibleText.match(pricePattern) ?? []).map(value => cleanText(value, 80)))).slice(0, 30)

  return {
    title,
    description,
    headings,
    prices,
    callsToAction,
    normalizedText: visibleText,
  }
}

function evidenceDigest(evidence: PageEvidence): string {
  return JSON.stringify({
    title: evidence.title,
    description: evidence.description,
    headings: evidence.headings,
    prices: evidence.prices,
    callsToAction: evidence.callsToAction,
    normalizedText: evidence.normalizedText,
  })
}

function evidenceSummary(evidence: PageEvidence): string {
  return [
    evidence.title && `Title: ${evidence.title}`,
    evidence.description && `Description: ${evidence.description}`,
    evidence.headings.length > 0 && `Headings: ${evidence.headings.slice(0, 6).join(' | ')}`,
    evidence.prices.length > 0 && `Prices: ${evidence.prices.slice(0, 10).join(', ')}`,
    evidence.callsToAction.length > 0 && `Calls to action: ${evidence.callsToAction.slice(0, 8).join(', ')}`,
  ].filter(Boolean).join('\n').slice(0, 4_000)
}

function arraysDiffer(left: string[], right: string[]): boolean {
  return JSON.stringify(left) !== JSON.stringify(right)
}

export function classifyCompetitorChange(
  competitorName: string,
  before: PageEvidence,
  after: PageEvidence,
): ChangeClassification {
  if (arraysDiffer(before.prices, after.prices)) {
    return {
      type: 'PRICE_CHANGE',
      title: `${competitorName}: public price text changed`,
      summary: 'Price-like text on the monitored public page changed. Review the before/after evidence and the live source before using it.',
      beforeText: evidenceSummary(before),
      afterText: evidenceSummary(after),
      confidence: 92,
      importance: 1,
    }
  }
  if (before.description !== after.description || arraysDiffer(before.headings, after.headings)) {
    return {
      type: 'OFFER_CHANGE',
      title: `${competitorName}: offer or page messaging changed`,
      summary: 'The public page description or prominent headings changed. This is a source observation, not a performance result.',
      beforeText: evidenceSummary(before),
      afterText: evidenceSummary(after),
      confidence: 86,
      importance: 2,
    }
  }
  if (arraysDiffer(before.callsToAction, after.callsToAction)) {
    return {
      type: 'CTA_CHANGE',
      title: `${competitorName}: calls to action changed`,
      summary: 'Calls to action on the monitored public page changed. No conversion impact is inferred.',
      beforeText: evidenceSummary(before),
      afterText: evidenceSummary(after),
      confidence: 84,
      importance: 2,
    }
  }
  if (before.title !== after.title) {
    return {
      type: 'MESSAGE_CHANGE',
      title: `${competitorName}: page title changed`,
      summary: 'The title of the monitored public page changed. Review the source before drawing a strategic conclusion.',
      beforeText: evidenceSummary(before),
      afterText: evidenceSummary(after),
      confidence: 82,
      importance: 2,
    }
  }
  return {
    type: 'PAGE_CHANGE',
    title: `${competitorName}: public page content changed`,
    summary: 'The monitored public page changed outside the structured price, heading, title, or call-to-action fields.',
    beforeText: evidenceSummary(before),
    afterText: evidenceSummary(after),
    confidence: 70,
    importance: 3,
  }
}

function canonicalDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  )
}

function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  const version = isIP(normalized)
  if (version === 0) return false
  if (version === 4) return isPrivateIpv4(normalized)
  if (normalized === '::' || normalized === '::1') return true
  if (/^(fc|fd)/.test(normalized) || /^fe[89ab]/.test(normalized)) return true
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? isPrivateIpv4(mapped[1]) : false
}

export function normalizeCompetitorUrl(value: string): { url: string; domain: string } {
  const raw = value.trim()
  const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only public HTTP or HTTPS URLs are supported.')
  if (parsed.username || parsed.password) throw new Error('URLs containing credentials are not supported.')
  if (parsed.port && !['80', '443'].includes(parsed.port)) throw new Error('Only standard public web ports are supported.')
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (
    !hostname
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === 'metadata.google.internal'
    || isPrivateIp(hostname)
  ) {
    throw new Error('A public website URL is required.')
  }
  parsed.hash = ''
  if (!parsed.pathname) parsed.pathname = '/'
  return { url: parsed.toString(), domain: canonicalDomain(hostname) }
}

export function belongsToCompetitorDomain(value: string, domain: string): boolean {
  const parsed = normalizeCompetitorUrl(value)
  return parsed.domain === canonicalDomain(domain)
}

async function assertPublicNetworkTarget(value: string): Promise<void> {
  const { url } = normalizeCompetitorUrl(value)
  const hostname = new URL(url).hostname
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Private network targets are blocked.')
    return
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some(item => isPrivateIp(item.address))) {
    throw new Error('The hostname does not resolve exclusively to public IP addresses.')
  }
}

async function readTextLimited(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('The source page is larger than the 1 MB monitoring limit.')
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('The source page exceeded the 1 MB monitoring limit.')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')
}

async function safeFetch(
  value: string,
  headers: Record<string, string> = {},
): Promise<{ response: Response; finalUrl: string }> {
  let current = normalizeCompetitorUrl(value).url
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    await assertPublicNetworkTarget(current)
    const response = await fetch(current, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8', ...headers },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: current }
    const location = response.headers.get('location')
    if (!location) throw new Error('The source returned a redirect without a destination.')
    current = normalizeCompetitorUrl(new URL(location, current).toString()).url
  }
  throw new Error('The source exceeded the redirect limit.')
}

export function isRobotsPathAllowed(robotsText: string, pathname: string): boolean {
  const groups = robotsText.split(/\n(?=\s*user-agent\s*:)/i)
  const relevant = groups.filter(group => /user-agent\s*:\s*(?:\*|NexusCompetitorMonitor)/i.test(group))
  if (relevant.length === 0) return true

  let bestRule: { allowed: boolean; length: number } | null = null
  for (const group of relevant) {
    for (const line of group.split(/\r?\n/)) {
      const match = line.replace(/#.*$/, '').match(/^\s*(allow|disallow)\s*:\s*(.*?)\s*$/i)
      if (!match || !match[2]) continue
      const rulePath = match[2].replace(/\*.*$/, '')
      if (!rulePath || !pathname.startsWith(rulePath)) continue
      const candidate = { allowed: match[1].toLowerCase() === 'allow', length: rulePath.length }
      if (!bestRule || candidate.length >= bestRule.length) bestRule = candidate
    }
  }
  return bestRule?.allowed ?? true
}

async function robotsAllows(value: string): Promise<boolean> {
  const parsed = new URL(normalizeCompetitorUrl(value).url)
  const robotsUrl = new URL('/robots.txt', parsed.origin).toString()
  const { response } = await safeFetch(robotsUrl, { Accept: 'text/plain' })
  if (response.status === 404) return true
  if (!response.ok) throw new Error(`robots.txt returned HTTP ${response.status}.`)
  const robotsText = await readTextLimited(response)
  return isRobotsPathAllowed(robotsText, parsed.pathname || '/')
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + Math.max(1, hours) * 3_600_000)
}

export async function scanCompetitorSource(
  sourceId: string,
  trigger: 'BASELINE' | 'MANUAL' | 'CRON',
): Promise<CompetitorScanResult> {
  const source = await db.competitorSource.findUnique({
    where: { id: sourceId },
    include: {
      competitor: true,
    },
  })
  if (
    !source
    || !source.enabled
    || source.competitor.status !== 'ACTIVE'
    || source.competitor.contextReviewRequired
    || !source.competitor.brandContextFingerprint
  ) {
    return { sourceId, checked: false, baselineCreated: false, changed: false, signalCreated: false, error: 'Source is not active.' }
  }

  const checkedAt = new Date()
  try {
    const contextFingerprint = source.competitor.brandContextFingerprint as string
    const previous = await db.competitorSnapshot.findFirst({
      where: {
        sourceId: source.id,
        contentHash: { startsWith: `${contextFingerprint}:` },
      },
      orderBy: { capturedAt: 'desc' },
    })
    if (!belongsToCompetitorDomain(source.url, source.competitor.domain)) {
      throw new Error('The source no longer belongs to the user-confirmed competitor domain.')
    }
    const allowed = await robotsAllows(source.url)
    if (!allowed) throw new Error('robots.txt does not allow monitoring this path.')

    const conditionalHeaders: Record<string, string> = {}
    if (source.etag) conditionalHeaders['If-None-Match'] = source.etag
    if (source.lastModified) conditionalHeaders['If-Modified-Since'] = source.lastModified
    const { response, finalUrl } = await safeFetch(source.url, conditionalHeaders)

    const currentContext = await db.competitor.findFirst({
      where: {
        id: source.competitorId,
        status: 'ACTIVE',
        contextReviewRequired: false,
        brandContextFingerprint: contextFingerprint,
      },
      select: { id: true },
    })
    if (!currentContext) throw new CompetitorContextChangedError()

    if (response.status === 304) {
      await db.competitorSource.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: checkedAt,
          lastSuccessAt: checkedAt,
          lastStatusCode: 304,
          robotsAllowed: true,
          lastError: null,
          nextScanAt: hoursFromNow(source.cadenceHours),
          leaseUntil: null,
          leaseToken: null,
        },
      })
      await db.competitor.update({
        where: { id: source.competitorId },
        data: { lastScanAt: checkedAt, nextScanAt: hoursFromNow(source.cadenceHours), lastError: null },
      })
      return { sourceId, checked: true, baselineCreated: false, changed: false, signalCreated: false, statusCode: 304 }
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`)
    if (!belongsToCompetitorDomain(finalUrl, source.competitor.domain)) {
      throw new Error('The source redirected outside the user-confirmed competitor domain.')
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported source content type: ${contentType.split(';')[0]}.`)
    }

    const html = await readTextLimited(response)
    const evidence = extractPageEvidence(html)
    if (evidence.normalizedText.length < 80) throw new Error('The source did not expose enough readable public text to monitor reliably.')
    const evidenceHash = createHash('sha256').update(evidenceDigest(evidence)).digest('hex')
    // Context-prefixing keeps the existing database uniqueness contract fully
    // backward compatible while making identical source content a fresh
    // baseline after the user confirms a different Brand Brain identity.
    const contentHash = `${contextFingerprint}:${evidenceHash}`
    const baselineCreated = !previous
    const changed = Boolean(previous && previous.contentHash !== contentHash)

    let signalCreated = false
    await prisma.$transaction(async transaction => {
      const tx = transaction as any
      const stillCurrent = await tx.competitor.findFirst({
        where: {
          id: source.competitorId,
          status: 'ACTIVE',
          contextReviewRequired: false,
          brandContextFingerprint: contextFingerprint,
        },
        select: { id: true },
      })
      if (!stillCurrent) throw new CompetitorContextChangedError()

      const snapshot = await tx.competitorSnapshot.upsert({
        where: { sourceId_contentHash: { sourceId: source.id, contentHash } },
        update: {},
        create: {
          workspaceId: source.workspaceId,
          sourceId: source.id,
          contentHash,
          title: evidence.title || null,
          normalizedText: evidence.normalizedText,
          extracted: evidence,
        },
      })

      if (changed && previous) {
        const before = previous.extracted as PageEvidence
        const classification = classifyCompetitorChange(source.competitor.name, before, evidence)
        const fingerprint = createHash('sha256')
          .update(`${source.id}:${previous.contentHash}:${contentHash}`)
          .digest('hex')
        const existing = await tx.competitorSignal.findUnique({ where: { fingerprint }, select: { id: true } })
        if (!existing) {
          await tx.competitorSignal.create({
            data: {
              workspaceId: source.workspaceId,
              competitorId: source.competitorId,
              sourceId: source.id,
              previousSnapshotId: previous.id,
              currentSnapshotId: snapshot.id,
              fingerprint,
              type: classification.type,
              title: classification.title,
              summary: classification.summary,
              beforeText: classification.beforeText || null,
              afterText: classification.afterText || null,
              evidence: {
                sourceUrl: finalUrl,
                previousContentHash: previous.contentHash,
                currentContentHash: contentHash,
                previousCapturedAt: previous.capturedAt,
                currentCapturedAt: checkedAt,
                performanceClaim: false,
                autoLearningApplied: false,
              },
              confidence: classification.confidence,
              importance: classification.importance,
            },
          })
          signalCreated = true
        }
      }

      await tx.competitorSource.update({
        where: { id: source.id },
        data: {
          url: finalUrl,
          normalizedUrl: normalizeCompetitorUrl(finalUrl).url,
          lastCheckedAt: checkedAt,
          lastSuccessAt: checkedAt,
          lastStatusCode: response.status,
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified'),
          lastHash: contentHash,
          robotsAllowed: true,
          lastError: null,
          nextScanAt: hoursFromNow(source.cadenceHours),
          leaseUntil: null,
          leaseToken: null,
        },
      })
      await tx.competitor.update({
        where: { id: source.competitorId },
        data: {
          baselineStatus: 'READY',
          baselineAt: baselineCreated ? checkedAt : source.competitor.baselineAt,
          lastScanAt: checkedAt,
          nextScanAt: hoursFromNow(source.cadenceHours),
          lastError: null,
        },
      })
    })

    return {
      sourceId,
      checked: true,
      baselineCreated,
      changed,
      signalCreated,
      statusCode: response.status,
    }
  } catch (error) {
    if (error instanceof CompetitorContextChangedError) {
      return {
        sourceId,
        checked: false,
        baselineCreated: false,
        changed: false,
        signalCreated: false,
        error: error.message,
      }
    }
    const message = error instanceof Error ? error.message : 'Competitor source scan failed.'
    await Promise.all([
      db.competitorSource.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: checkedAt,
          robotsAllowed: message.includes('robots.txt') ? false : source.robotsAllowed,
          lastError: message.slice(0, 1_000),
          nextScanAt: hoursFromNow(trigger === 'CRON' ? 6 : 1),
          leaseUntil: null,
          leaseToken: null,
        },
      }),
      db.competitor.update({
        where: { id: source.competitorId },
        data: {
          baselineStatus: source.competitor.baselineAt ? source.competitor.baselineStatus : 'FAILED',
          lastScanAt: checkedAt,
          nextScanAt: hoursFromNow(trigger === 'CRON' ? 6 : 1),
          lastError: message.slice(0, 1_000),
        },
      }),
    ])
    return { sourceId, checked: false, baselineCreated: false, changed: false, signalCreated: false, error: message }
  }
}

export async function claimDueCompetitorSources(limit = 4): Promise<Array<{ id: string; workspaceId: string }>> {
  const due = await db.competitorSource.findMany({
    where: {
      enabled: true,
      nextScanAt: { lte: new Date() },
      competitor: {
        status: 'ACTIVE',
        contextReviewRequired: false,
        brandContextFingerprint: { not: null },
      },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    orderBy: { nextScanAt: 'asc' },
    select: { id: true, workspaceId: true },
    take: Math.max(1, Math.min(limit, 10)),
  })

  const claimed: Array<{ id: string; workspaceId: string }> = []
  for (const source of due) {
    const token = randomUUID()
    const result = await db.competitorSource.updateMany({
      where: {
        id: source.id,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: { leaseToken: token, leaseUntil: new Date(Date.now() + 5 * 60_000) },
    })
    if (result.count === 1) claimed.push(source)
  }
  return claimed
}
