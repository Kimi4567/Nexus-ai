export const CREATIVE_INTELLIGENCE_VERSION = 1
export const CREATIVE_INTELLIGENCE_BATCH_LIMIT = 8

export type MediaIntelligenceStatus = 'UNANALYZED' | 'READY' | 'FAILED' | 'NEEDS_PREVIEW'
export type CreativeCompatibility = 'DIRECT' | 'REFERENCE' | 'INCOMPATIBLE'
export type CreativeMatchVerdict = 'STRONG' | 'PARTIAL' | 'WEAK' | 'REJECTED'
export type CreativeMatchDecision =
  | 'USE_EXISTING'
  | 'ADAPT_COPY'
  | 'GENERATE_FROM_REFERENCE'
  | 'CREATE_NEW'

export interface MediaIntelligenceAnalysis {
  version: number
  visibleSummary: string
  assetKind: 'PRODUCT' | 'PACKAGING' | 'LIFESTYLE' | 'DEMO' | 'TESTIMONIAL' | 'SCREEN' | 'PERSON' | 'LOGO' | 'OTHER'
  language: 'AR' | 'EN' | 'MIXED' | 'NONE'
  products: string[]
  visibleObjects: string[]
  visibleActions: string[]
  visibleText: string[]
  safeThemes: string[]
  possibleUseCases: string[]
  recommendedPlatforms: string[]
  funnelStages: Array<'AWARENESS' | 'CONSIDERATION' | 'CONVERSION'>
  evidenceLimits: string[]
  qualityScore: number
  qualityIssues: string[]
  rightsStatus: 'UNCONFIRMED'
  audioStatus: 'NOT_ANALYZED'
  sourceFrames: string[]
}

export interface CreativeMediaCandidate {
  id: string
  url: string
  fileName: string
  type: string
  mimeType?: string | null
  width?: number | null
  height?: number | null
  duration?: number | null
  category?: string | null
  tags?: string[]
  intelligenceStatus?: string | null
  intelligence?: unknown
}

export interface CreativePostCandidate {
  id: string
  caption: string
  imagePrompt?: string | null
  videoPrompt?: string | null
  platform: string
  isVideoPost: boolean
  contentPlanIndex?: number | null
}

const VIDEO_STUDIO_OUTPUT_CATEGORIES = new Set([
  'source-locked-motion-design-ad',
  'professional-campaign-film-master',
  'cinematic-product-ad-master',
])

/**
 * Creative Intelligence is for original user media that can ground a campaign
 * decision. Final Video Studio masters remain in the Media Library and on the
 * post, but must not re-enter analysis or be suggested as recursive sources.
 */
export function isCreativeIntelligenceSourceCandidate(
  media: Pick<CreativeMediaCandidate, 'category' | 'tags'>,
): boolean {
  const category = String(media.category ?? '').trim().toLowerCase()
  const tags = (media.tags ?? []).map(tag => String(tag).trim().toLowerCase())
  return !VIDEO_STUDIO_OUTPUT_CATEGORIES.has(category) && !tags.includes('nexus-video-studio')
}

export interface CreativeMediaMatch {
  postId: string
  mediaId: string
  score: number
  verdict: CreativeMatchVerdict
  compatibility: CreativeCompatibility
  recommendedDecision: CreativeMatchDecision
  reasons: string[]
  gaps: string[]
  analysisVersion: number
}

export interface StoredCreativeMatch {
  version: number
  generatedAt: string
  topMatches: CreativeMediaMatch[]
}

export interface CreativeIntelligencePayload {
  version: number
  summary: {
    totalAssets: number
    analyzedAssets: number
    pendingAssets: number
    batchSize: number
    matchedPosts: number
    totalPosts: number
  }
  matchesByPostId: Record<string, CreativeMediaMatch[]>
  assetsById: Record<string, CreativeMediaCandidate>
}

const ARABIC_STOPWORDS = new Set([
  'في', 'من', 'على', 'إلى', 'الى', 'عن', 'مع', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
  'كل', 'ثم', 'او', 'أو', 'ما', 'لا', 'لم', 'لن', 'لك', 'لدى', 'عند', 'بعد', 'قبل', 'بين', 'حتى',
])
const ENGLISH_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'from', 'this', 'that',
  'your', 'our', 'is', 'are', 'be', 'as', 'by', 'at', 'it', 'you', 'we', 'will', 'can', 'not',
])

function boundedText(value: unknown, max = 220): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

function boundedList(value: unknown, maxItems = 8, maxLength = 120): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => boundedText(item, maxLength)).filter(Boolean))).slice(0, maxItems)
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return allowed.includes(normalized as T) ? normalized as T : fallback
}

function safeScore(value: unknown, fallback = 0): number {
  const numeric = Math.round(Number(value))
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : fallback
}

export function normalizeMediaIntelligence(
  value: unknown,
  sourceFrames: string[] = [],
): MediaIntelligenceAnalysis {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const funnelStages = boundedList(input.funnelStages, 3, 32)
    .map(item => oneOf(item, ['AWARENESS', 'CONSIDERATION', 'CONVERSION'] as const, 'AWARENESS'))

  return {
    version: CREATIVE_INTELLIGENCE_VERSION,
    visibleSummary: boundedText(input.visibleSummary, 360) || 'Visual evidence was not described clearly enough.',
    assetKind: oneOf(input.assetKind, ['PRODUCT', 'PACKAGING', 'LIFESTYLE', 'DEMO', 'TESTIMONIAL', 'SCREEN', 'PERSON', 'LOGO', 'OTHER'] as const, 'OTHER'),
    language: oneOf(input.language, ['AR', 'EN', 'MIXED', 'NONE'] as const, 'NONE'),
    products: boundedList(input.products),
    visibleObjects: boundedList(input.visibleObjects),
    visibleActions: boundedList(input.visibleActions),
    visibleText: boundedList(input.visibleText),
    safeThemes: boundedList(input.safeThemes),
    possibleUseCases: boundedList(input.possibleUseCases),
    recommendedPlatforms: boundedList(input.recommendedPlatforms, 8, 32).map(item => item.toUpperCase()),
    funnelStages: Array.from(new Set(funnelStages)),
    evidenceLimits: boundedList(input.evidenceLimits).length > 0
      ? boundedList(input.evidenceLimits)
      : ['No performance, testimonial, ownership, or product claim is verified by visual analysis alone.'],
    qualityScore: safeScore(input.qualityScore, 50),
    qualityIssues: boundedList(input.qualityIssues),
    // These fields are deliberately server-owned. Visual recognition cannot
    // establish usage rights and this pass does not transcribe audio.
    rightsStatus: 'UNCONFIRMED',
    audioStatus: 'NOT_ANALYZED',
    sourceFrames: sourceFrames.slice(0, 3),
  }
}

export function readMediaIntelligence(value: unknown): MediaIntelligenceAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Number(input.version) !== CREATIVE_INTELLIGENCE_VERSION) return null
  return normalizeMediaIntelligence(input, boundedList(input.sourceFrames, 3, 500))
}

function normalizedTokens(value: string): Set<string> {
  const normalized = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
  return new Set(normalized.split(/\s+/).filter(token => (
    token.length >= 3
    && !ARABIC_STOPWORDS.has(token)
    && !ENGLISH_STOPWORDS.has(token)
  )))
}

function mediaText(media: CreativeMediaCandidate, analysis: MediaIntelligenceAnalysis | null): string {
  return [
    media.fileName,
    media.category,
    ...(media.tags ?? []),
    analysis?.visibleSummary,
    ...(analysis?.products ?? []),
    ...(analysis?.visibleObjects ?? []),
    ...(analysis?.visibleActions ?? []),
    ...(analysis?.visibleText ?? []),
    ...(analysis?.safeThemes ?? []),
    ...(analysis?.possibleUseCases ?? []),
  ].filter(Boolean).join(' ')
}

function postText(post: CreativePostCandidate): string {
  return [post.caption, post.imagePrompt, post.videoPrompt].filter(Boolean).join(' ')
}

export function getCreativeCompatibility(
  post: Pick<CreativePostCandidate, 'isVideoPost'>,
  media: Pick<CreativeMediaCandidate, 'type'>,
): CreativeCompatibility {
  const mediaType = String(media.type).toUpperCase()
  if (post.isVideoPost && mediaType === 'VIDEO') return 'DIRECT'
  if (post.isVideoPost && ['IMAGE', 'LOGO'].includes(mediaType)) return 'REFERENCE'
  if (!post.isVideoPost && ['IMAGE', 'LOGO'].includes(mediaType)) return 'DIRECT'
  return 'INCOMPATIBLE'
}

function lexicalSimilarity(left: string, right: string): number {
  const leftTokens = normalizedTokens(left)
  const rightTokens = normalizedTokens(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  let overlap = 0
  for (const token of leftTokens) if (rightTokens.has(token)) overlap += 1
  return overlap / Math.max(3, Math.min(leftTokens.size, rightTokens.size))
}

export function deriveCreativeMatch(
  post: CreativePostCandidate,
  media: CreativeMediaCandidate,
  providerSuggestion?: Partial<CreativeMediaMatch> | null,
): CreativeMediaMatch {
  const compatibility = getCreativeCompatibility(post, media)
  const analysis = readMediaIntelligence(media.intelligence)
  if (compatibility === 'INCOMPATIBLE') {
    return {
      postId: post.id,
      mediaId: media.id,
      score: 0,
      verdict: 'REJECTED',
      compatibility,
      recommendedDecision: 'CREATE_NEW',
      reasons: ['The media type cannot be attached to this post slot.'],
      gaps: ['Choose a compatible asset or create new media.'],
      analysisVersion: CREATIVE_INTELLIGENCE_VERSION,
    }
  }

  const similarity = lexicalSimilarity(postText(post), mediaText(media, analysis))
  const platformFit = analysis?.recommendedPlatforms.includes(post.platform.toUpperCase()) ? 10 : 0
  const qualityFit = analysis ? Math.round(analysis.qualityScore / 10) : 0
  const compatibilityBase = compatibility === 'DIRECT' ? 24 : 16
  const deterministicScore = Math.min(100, compatibilityBase + Math.round(similarity * 50) + platformFit + qualityFit)
  const providerScore = safeScore(providerSuggestion?.score, deterministicScore)
  const analysisReady = Boolean(analysis) && media.intelligenceStatus === 'READY'
  const blendedScore = analysisReady
    ? Math.round((providerScore * 0.7) + (deterministicScore * 0.3))
    : Math.min(34, deterministicScore)
  const score = compatibility === 'REFERENCE' ? Math.min(84, blendedScore) : blendedScore
  const verdict: CreativeMatchVerdict = !analysisReady
    ? 'WEAK'
    : score >= 72
      ? 'STRONG'
      : score >= 48
        ? 'PARTIAL'
        : 'WEAK'
  const recommendedDecision: CreativeMatchDecision = compatibility === 'REFERENCE'
    ? 'GENERATE_FROM_REFERENCE'
    : verdict === 'STRONG'
      ? 'USE_EXISTING'
      : verdict === 'PARTIAL'
        ? 'ADAPT_COPY'
        : 'CREATE_NEW'

  const providerReasons = boundedList(providerSuggestion?.reasons, 3, 160)
  const providerGaps = boundedList(providerSuggestion?.gaps, 3, 160)
  const reasons = providerReasons.length > 0
    ? providerReasons
    : analysisReady
      ? [
          compatibility === 'REFERENCE'
            ? 'The asset can preserve the real product as a generation reference.'
            : 'The asset format can be used directly in this post slot.',
          ...(platformFit ? ['Its recommended channel includes this post platform.'] : []),
        ]
      : ['This asset must be analyzed before NEXUS can claim a meaningful match.']
  const gaps = providerGaps.length > 0
    ? providerGaps
    : analysisReady
      ? (similarity < 0.12 ? ['The visible subject and the post message have limited semantic overlap.'] : [])
      : ['Visual subject, message fit, and evidence limits are not analyzed yet.']

  return {
    postId: post.id,
    mediaId: media.id,
    score,
    verdict,
    compatibility,
    recommendedDecision,
    reasons: reasons.slice(0, 3),
    gaps: gaps.slice(0, 3),
    analysisVersion: CREATIVE_INTELLIGENCE_VERSION,
  }
}

export function rankCreativeMediaForPost(
  post: CreativePostCandidate,
  media: CreativeMediaCandidate[],
  providerSuggestions: Array<Partial<CreativeMediaMatch>> = [],
  limit = 3,
): CreativeMediaMatch[] {
  const suggestions = new Map(providerSuggestions
    .filter(item => item.postId === post.id && typeof item.mediaId === 'string')
    .map(item => [String(item.mediaId), item]))
  return media
    .map(item => deriveCreativeMatch(post, item, suggestions.get(item.id)))
    .filter(match => match.compatibility !== 'INCOMPATIBLE')
    .sort((a, b) => b.score - a.score || a.mediaId.localeCompare(b.mediaId))
    .slice(0, Math.max(1, limit))
}

export function normalizeProviderMatches(
  value: unknown,
  posts: CreativePostCandidate[],
  media: CreativeMediaCandidate[],
): Array<Partial<CreativeMediaMatch>> {
  if (!Array.isArray(value)) return []
  const postIds = new Set(posts.map(post => post.id))
  const mediaIds = new Set(media.map(item => item.id))
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const input = item as Record<string, unknown>
    const postId = boundedText(input.postId, 80)
    const mediaId = boundedText(input.mediaId, 80)
    if (!postIds.has(postId) || !mediaIds.has(mediaId)) return []
    return [{
      postId,
      mediaId,
      score: safeScore(input.score),
      reasons: boundedList(input.reasons, 3, 160),
      gaps: boundedList(input.gaps, 3, 160),
    }]
  })
}

export function buildCreativeIntelligencePayload(input: {
  posts: CreativePostCandidate[]
  media: CreativeMediaCandidate[]
  storedMatches?: Record<string, StoredCreativeMatch | null | undefined>
  providerSuggestions?: Array<Partial<CreativeMediaMatch>>
}): CreativeIntelligencePayload {
  const assetsById = Object.fromEntries(input.media.map(item => [item.id, item]))
  const matchesByPostId: Record<string, CreativeMediaMatch[]> = {}
  let matchedPosts = 0
  for (const post of input.posts) {
    const stored = input.storedMatches?.[post.id]
    const storedMatches = stored?.version === CREATIVE_INTELLIGENCE_VERSION
      ? stored.topMatches.filter(match => assetsById[match.mediaId])
      : []
    const matches = storedMatches.length > 0
      ? storedMatches
      : rankCreativeMediaForPost(post, input.media, input.providerSuggestions)
    matchesByPostId[post.id] = matches
    if (matches.some(match => match.verdict === 'STRONG' || match.verdict === 'PARTIAL')) matchedPosts += 1
  }

  const analyzedAssets = input.media.filter(item => (
    item.intelligenceStatus === 'READY' && readMediaIntelligence(item.intelligence)
  )).length
  return {
    version: CREATIVE_INTELLIGENCE_VERSION,
    summary: {
      totalAssets: input.media.length,
      analyzedAssets,
      pendingAssets: Math.max(0, input.media.length - analyzedAssets),
      batchSize: Math.min(CREATIVE_INTELLIGENCE_BATCH_LIMIT, Math.max(0, input.media.length - analyzedAssets)),
      matchedPosts,
      totalPosts: input.posts.length,
    },
    matchesByPostId,
    assetsById,
  }
}

export function parseStoredCreativeMatch(value: unknown): StoredCreativeMatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Number(input.version) !== CREATIVE_INTELLIGENCE_VERSION || !Array.isArray(input.topMatches)) return null
  const topMatches = input.topMatches.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const match = item as Record<string, unknown>
    const postId = boundedText(match.postId, 80)
    const mediaId = boundedText(match.mediaId, 80)
    if (!postId || !mediaId) return []
    const compatibility = oneOf(match.compatibility, ['DIRECT', 'REFERENCE', 'INCOMPATIBLE'] as const, 'INCOMPATIBLE')
    const verdict = oneOf(match.verdict, ['STRONG', 'PARTIAL', 'WEAK', 'REJECTED'] as const, 'WEAK')
    const recommendedDecision = oneOf(match.recommendedDecision, ['USE_EXISTING', 'ADAPT_COPY', 'GENERATE_FROM_REFERENCE', 'CREATE_NEW'] as const, 'CREATE_NEW')
    return [{
      postId,
      mediaId,
      score: safeScore(match.score),
      verdict,
      compatibility,
      recommendedDecision,
      reasons: boundedList(match.reasons, 3, 160),
      gaps: boundedList(match.gaps, 3, 160),
      analysisVersion: CREATIVE_INTELLIGENCE_VERSION,
    } satisfies CreativeMediaMatch]
  })
  return {
    version: CREATIVE_INTELLIGENCE_VERSION,
    generatedAt: boundedText(input.generatedAt, 80) || new Date(0).toISOString(),
    topMatches,
  }
}
