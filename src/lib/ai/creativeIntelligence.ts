import {
  normalizeMediaIntelligence,
  normalizeProviderMatches,
  type CreativeMediaCandidate,
  type CreativePostCandidate,
  type MediaIntelligenceAnalysis,
} from '@/lib/creativeIntelligence'
import { readOpenAIChatUsage, summarizeOpenAITextUsage, type ProviderUsageSummary } from '@/lib/ai/providerEconomics'

const MODEL = 'gpt-4o'

interface AnalysisResult {
  analysesByMediaId: Record<string, MediaIntelligenceAnalysis>
  providerMatches: ReturnType<typeof normalizeProviderMatches>
  needsPreviewIds: string[]
  usage: ProviderUsageSummary
}

interface AdaptedCopyResult {
  caption: string
  changeSummary: string
  unsupportedClaimsRemoved: string[]
  usage: ProviderUsageSummary
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('NEXUS AI returned no usable analysis')
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    }
  }
  throw new Error('NEXUS AI returned an invalid analysis')
}

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function getMediaEvidenceFrames(media: CreativeMediaCandidate): string[] {
  const url = safeHttpsUrl(media.url)
  if (!url) return []
  const type = String(media.type).toUpperCase()
  if (['IMAGE', 'LOGO'].includes(type)) return [url]
  if (type !== 'VIDEO' || !url.includes('/video/upload/')) return []
  const midpoint = Math.max(1, Math.min(4, Math.floor(Number(media.duration) / 2) || 2))
  return [
    url.replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto/'),
    url.replace('/video/upload/', `/video/upload/so_${midpoint},f_jpg,q_auto/`),
  ]
}

function boundedProviderAssets(media: CreativeMediaCandidate[]): Array<CreativeMediaCandidate & { frames: string[] }> {
  let imageBudget = 16
  const bounded: Array<CreativeMediaCandidate & { frames: string[] }> = []
  for (const asset of media) {
    const frames = getMediaEvidenceFrames(asset)
    if (frames.length === 0 || imageBudget <= 0) continue
    const allowedFrames = frames.slice(0, imageBudget)
    imageBudget -= allowedFrames.length
    bounded.push({ ...asset, frames: allowedFrames })
  }
  return bounded
}

export async function analyzeCampaignMedia(input: {
  media: CreativeMediaCandidate[]
  posts: CreativePostCandidate[]
  brandContext: Record<string, unknown>
  locale?: 'ar' | 'en'
}): Promise<AnalysisResult> {
  const providerAssets = boundedProviderAssets(input.media)
  const needsPreviewIds = input.media
    .filter(asset => !providerAssets.some(item => item.id === asset.id))
    .map(asset => asset.id)
  if (providerAssets.length === 0) {
    throw new Error('No image or previewable video was available for analysis')
  }

  const assetManifest = providerAssets.map(asset => ({
    mediaId: asset.id,
    fileName: asset.fileName,
    type: asset.type,
    width: asset.width ?? null,
    height: asset.height ?? null,
    duration: asset.duration ?? null,
    category: asset.category ?? null,
    existingTags: asset.tags ?? [],
    frameCount: asset.frames.length,
  }))
  const postManifest = input.posts.map(post => ({
    postId: post.id,
    index: post.contentPlanIndex ?? null,
    platform: post.platform,
    mediaSlot: post.isVideoPost ? 'VIDEO' : 'IMAGE',
    caption: post.caption.slice(0, 1200),
    creativeDirection: (post.videoPrompt || post.imagePrompt || '').slice(0, 600),
  }))

  const narrativeLanguage = input.locale === 'ar' ? 'Modern Standard Arabic' : 'English'
  const content: Array<Record<string, unknown>> = [{
    type: 'text',
    text: `Analyze the supplied campaign media using visible evidence only, then assess how well each asset supports each post.

TRUTH RULES:
- Never invent product features, performance, testimonials, people, locations, ownership, rights, results, or events.
- A visible marketing claim is text seen in the asset, not a verified fact.
- If evidence is missing, leave arrays empty and state the limitation.
- rightsStatus must remain UNCONFIRMED. Audio is not analyzed in this pass.
- A direct match means the asset can be used as-is in that post type. An image may also be a REFERENCE for generating a video, but a video cannot be attached to an image slot.
- Match reasons must cite visible subject/action/text or format. Gaps must say what the asset does not show.
- Scores: 80-100 strong direct support; 55-79 partial and needs adaptation; below 55 weak. Do not inflate scores.
- Write every user-facing narrative value (summaries, reasons, gaps, limits,
  quality issues, themes, and use cases) in ${narrativeLanguage}. Keep JSON keys,
  IDs, enum values, and platform names exactly as specified in English.
- When assetKind is PRODUCT or PACKAGING, products must contain one concise,
  visible-only identity description (for example "black abaya with silver
  embroidered trim"). This is an appearance label, not a brand, ownership,
  material, quality, or performance claim. Leave products empty only when no
  product or packaging is visibly identifiable.
- Use assetKind PROPERTY only for a photograph whose primary visible subject is
  a residential or commercial property exterior, room, architectural space, or
  permanent property feature. Describe only what is visible. Never infer the
  address, development, price, room count, area, view name, availability,
  ownership, ROI, amenities outside the frame, or that multiple photos show the
  same property.

BRAND CONTEXT (user supplied, not visual proof):
${JSON.stringify(input.brandContext).slice(0, 5000)}

POSTS:
${JSON.stringify(postManifest)}

ASSETS:
${JSON.stringify(assetManifest)}

Return one JSON object exactly in this shape:
{
  "assets": [{
    "mediaId": "known id",
    "visibleSummary": "what is visibly present",
    "assetKind": "PRODUCT|PACKAGING|PROPERTY|LIFESTYLE|DEMO|TESTIMONIAL|SCREEN|PERSON|LOGO|OTHER",
    "language": "AR|EN|MIXED|NONE",
    "products": ["concise visible-only product identity when applicable"],
    "visibleObjects": [],
    "visibleActions": [],
    "visibleText": [],
    "safeThemes": [],
    "possibleUseCases": [],
    "recommendedPlatforms": [],
    "funnelStages": ["AWARENESS|CONSIDERATION|CONVERSION"],
    "evidenceLimits": [],
    "qualityScore": 0,
    "qualityIssues": []
  }],
  "matches": [{
    "postId": "known post id",
    "mediaId": "known media id",
    "score": 0,
    "reasons": ["specific evidence-backed reason"],
    "gaps": ["specific mismatch or missing evidence"]
  }]
}`,
  }]

  for (const asset of providerAssets) {
    content.push({ type: 'text', text: `MEDIA ${asset.id} — ${asset.fileName}` })
    for (const frame of asset.frames) {
      content.push({ type: 'image_url', image_url: { url: frame, detail: 'low' } })
    }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 4200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are NEXUS Creative Intelligence. Return source-grounded JSON only. Missing evidence must stay missing. User-facing narrative text must be in ${narrativeLanguage}.`,
        },
        { role: 'user', content },
      ],
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[creative-intelligence] provider analysis failed', response.status, detail.slice(0, 300))
    throw new Error('NEXUS media analysis is temporarily unavailable')
  }
  const data = await response.json()
  const parsed = parseJsonObject(data?.choices?.[0]?.message?.content)
  const knownAssets = new Map(providerAssets.map(asset => [asset.id, asset]))
  const analysesByMediaId: Record<string, MediaIntelligenceAnalysis> = {}
  const rawAssets = Array.isArray(parsed.assets) ? parsed.assets : []
  for (const value of rawAssets) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const asset = value as Record<string, unknown>
    const mediaId = typeof asset.mediaId === 'string' ? asset.mediaId : ''
    const known = knownAssets.get(mediaId)
    if (!known) continue
    analysesByMediaId[mediaId] = normalizeMediaIntelligence(asset, known.frames)
  }
  if (Object.keys(analysesByMediaId).length === 0) {
    throw new Error('NEXUS media analysis returned no usable asset evidence')
  }
  if (Object.keys(analysesByMediaId).length !== providerAssets.length) {
    throw new Error('NEXUS media analysis did not complete the confirmed asset batch')
  }

  const analyzedMedia = input.media.map(asset => analysesByMediaId[asset.id]
    ? { ...asset, intelligenceStatus: 'READY', intelligence: analysesByMediaId[asset.id] }
    : asset)
  const providerMatches = normalizeProviderMatches(parsed.matches, input.posts, analyzedMedia)
  return {
    analysesByMediaId,
    providerMatches,
    needsPreviewIds,
    usage: summarizeOpenAITextUsage(MODEL, [readOpenAIChatUsage(data?.usage)]),
  }
}

function numericClaims(value: string): Set<string> {
  return new Set(value.match(/(?:\d+[\d.,]*%?|[٠-٩]+[٠-٩.,]*٪?)/g) ?? [])
}

export async function adaptPostCopyToMedia(input: {
  post: CreativePostCandidate
  media: CreativeMediaCandidate
  analysis: MediaIntelligenceAnalysis
  brandContext: Record<string, unknown>
  strategyContext: unknown
}): Promise<AdaptedCopyResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.25,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are NEXUS Creative Intelligence. Rewrite one social post so its copy honestly matches the selected real media while preserving the approved strategic objective.
Return JSON only. Do not add facts, numbers, proof, testimonials, results, product features, or offers that are absent from the original copy and supplied brand facts. Remove or soften any claim the visual evidence cannot support. Match the original language. Do not claim that the image/video itself proves an outcome.`,
        },
        {
          role: 'user',
          content: `ORIGINAL POST:
${JSON.stringify(input.post)}

OBSERVED MEDIA EVIDENCE:
${JSON.stringify(input.analysis)}

USER-SUPPLIED BRAND FACTS:
${JSON.stringify(input.brandContext).slice(0, 5000)}

STRATEGY CONTEXT:
${JSON.stringify(input.strategyContext).slice(0, 7000)}

Return:
{
  "caption": "final platform-ready caption",
  "changeSummary": "what changed and why",
  "unsupportedClaimsRemoved": ["removed or softened wording"]
}`,
        },
      ],
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[creative-intelligence] provider adaptation failed', response.status, detail.slice(0, 300))
    throw new Error('NEXUS could not adapt the copy right now')
  }
  const data = await response.json()
  const parsed = parseJsonObject(data?.choices?.[0]?.message?.content)
  const caption = typeof parsed.caption === 'string' ? parsed.caption.trim().slice(0, 5000) : ''
  if (caption.length < 20) throw new Error('NEXUS returned no usable adapted copy')

  const originalNumbers = numericClaims(input.post.caption)
  const adaptedNumbers = numericClaims(caption)
  const introducedNumber = Array.from(adaptedNumbers).find(value => !originalNumbers.has(value))
  if (introducedNumber) {
    throw new Error('NEXUS blocked an unsupported numeric claim in the adapted copy')
  }

  return {
    caption,
    changeSummary: typeof parsed.changeSummary === 'string'
      ? parsed.changeSummary.trim().slice(0, 500)
      : 'Copy aligned to the selected media evidence.',
    unsupportedClaimsRemoved: Array.isArray(parsed.unsupportedClaimsRemoved)
      ? parsed.unsupportedClaimsRemoved.filter((item: unknown): item is string => typeof item === 'string').map(item => item.trim().slice(0, 180)).filter(Boolean).slice(0, 6)
      : [],
    usage: summarizeOpenAITextUsage(MODEL, [readOpenAIChatUsage(data?.usage)]),
  }
}
