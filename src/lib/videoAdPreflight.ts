import { readMediaIntelligence } from '@/lib/creativeIntelligence'

export const CINEMATIC_PRODUCT_AD_DURATION_SECONDS = 8
export const CINEMATIC_PRODUCT_AD_MIN_REFERENCES = 2
export const CINEMATIC_PRODUCT_AD_MAX_REFERENCES = 4
export const CINEMATIC_PRODUCT_AD_PROVIDER_CREDITS_ESTIMATE = 344
export const CINEMATIC_PRODUCT_AD_PROVIDER_COST_USD_ESTIMATE = 3.44

export type VideoAdAssetInput = {
  id: string
  fileName?: string | null
  type?: string | null
  width?: number | null
  height?: number | null
  intelligenceStatus?: string | null
  intelligence?: unknown
}

export type VideoAdPreflightIssueCode =
  | 'REFERENCE_COUNT'
  | 'DUPLICATE_REFERENCE'
  | 'IMAGE_REQUIRED'
  | 'ANALYSIS_REQUIRED'
  | 'PRODUCT_REFERENCE_REQUIRED'
  | 'RESOLUTION_REQUIRED'
  | 'QUALITY_TOO_LOW'
  | 'UNSAFE_SOURCE_GRAPHICS'
  | 'CREATOR_REFERENCE_UNSUPPORTED'
  | 'PRODUCT_IDENTITY_MISMATCH'

export type VideoAdPreflightIssue = {
  code: VideoAdPreflightIssueCode
  mediaId?: string
  message: string
}

export type VideoAdPreflightResult = {
  eligible: boolean
  route: 'CINEMATIC_PRODUCT_AD' | 'MOTION_DESIGN_REQUIRED' | 'BLOCKED'
  issues: VideoAdPreflightIssue[]
  warnings: string[]
  qualifiedAssetIds: string[]
}

const UNSAFE_GRAPHIC_PATTERN = /watermark|overlaid?\s+text|text\s+overlay|screenshot|screen\s*capture|mockup\s*text|logo\s+overlay|علامة\s+مائية|نص\s+متراكب|لقطة\s+شاشة/i
const CREATOR_REFERENCE_PATTERN = /\b(?:person|people|woman|women|man|men|girl|boy|model|creator|human|face|portrait)\b|(?:امرأة|امراه|نساء|رجل|رجال|شخص|وجه|عارض|عارضة)/iu

// Vision models can identify an asset as PRODUCT while omitting the optional
// `products` label. A visible-description fallback is safe only after generic
// photography, person, pose, and background words are removed.
const GENERIC_PRODUCT_IDENTITY_TOKENS = new Set([
  'against', 'and', 'angle', 'background', 'close', 'detail', 'detailed', 'for',
  'front', 'from', 'full', 'image', 'into', 'item', 'model', 'neutral', 'packaging',
  'person', 'photo', 'plain', 'product', 'sitting', 'standing', 'studio', 'that',
  'the', 'this', 'view', 'wearing', 'with', 'woman',
])

function normalizedProductTokens(values: string[]): Set<string> {
  return new Set(values
    .join(' ')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3 && !GENERIC_PRODUCT_IDENTITY_TOKENS.has(token)))
}

function hasSharedProductIdentity(productLists: string[][]): boolean {
  if (productLists.length < CINEMATIC_PRODUCT_AD_MIN_REFERENCES) return false
  const tokenSets = productLists.map(normalizedProductTokens)
  // One shared category word is not proof that two references show the same
  // product. Require a category plus at least one visible differentiator.
  if (tokenSets.some(tokens => tokens.size < 2)) return false
  const [first, ...rest] = tokenSets
  const shared = Array.from(first).filter(token => rest.every(tokens => tokens.has(token)))
  return shared.length >= 2
}

/**
 * Fail-closed qualification for the expensive cinematic product-ad route.
 * Screens, UI mockups, logos, and unanalysed assets never reach the provider;
 * they require a deterministic motion-design workflow that preserves pixels.
 */
export function assessCinematicProductAdAssets(
  input: VideoAdAssetInput[],
): VideoAdPreflightResult {
  const issues: VideoAdPreflightIssue[] = []
  const warnings: string[] = []
  const assets = input.slice(0, CINEMATIC_PRODUCT_AD_MAX_REFERENCES + 1)
  const uniqueIds = new Set(assets.map(asset => asset.id))

  if (input.length < CINEMATIC_PRODUCT_AD_MIN_REFERENCES || input.length > CINEMATIC_PRODUCT_AD_MAX_REFERENCES) {
    issues.push({
      code: 'REFERENCE_COUNT',
      message: `Choose ${CINEMATIC_PRODUCT_AD_MIN_REFERENCES}–${CINEMATIC_PRODUCT_AD_MAX_REFERENCES} analysed photos of the same real product from different angles.`,
    })
  }
  if (uniqueIds.size !== assets.length) {
    issues.push({ code: 'DUPLICATE_REFERENCE', message: 'Each product angle must be a different media asset.' })
  }

  let motionDesignRequired = false
  const productLists: string[][] = []
  const qualifiedAssetIds: string[] = []

  for (const asset of assets) {
    if (String(asset.type).toUpperCase() !== 'IMAGE') {
      issues.push({ code: 'IMAGE_REQUIRED', mediaId: asset.id, message: `${asset.fileName || 'Reference'} must be a still product photo.` })
      continue
    }

    const analysis = asset.intelligenceStatus === 'READY'
      ? readMediaIntelligence(asset.intelligence)
      : null
    if (!analysis) {
      issues.push({ code: 'ANALYSIS_REQUIRED', mediaId: asset.id, message: `${asset.fileName || 'Reference'} must pass Media Intelligence first.` })
      continue
    }

    if (['SCREEN', 'LOGO', 'DEMO'].includes(analysis.assetKind)) {
      motionDesignRequired = true
      issues.push({
        code: 'PRODUCT_REFERENCE_REQUIRED',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} contains a screen, interface, demo, or logo. Use source-locked motion design instead of cinematic generation.`,
      })
      continue
    }
    if (!['PRODUCT', 'PACKAGING'].includes(analysis.assetKind)) {
      issues.push({
        code: 'PRODUCT_REFERENCE_REQUIRED',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} is not verified as a clear product or packaging photo.`,
      })
      continue
    }

    // The pinned Product Ad recipe is a product-shot workflow, not a creator
    // or likeness workflow. Sending a visible person can trigger an expensive
    // third-party safety failure after the task has already started. Fail
    // closed before debit/provider execution and route these assets toward a
    // source-locked image-motion or consented creator workflow instead.
    const visibleEvidence = [
      analysis.visibleSummary,
      ...analysis.visibleObjects,
      ...analysis.visibleActions,
    ].join(' ')
    if (CREATOR_REFERENCE_PATTERN.test(visibleEvidence)) {
      issues.push({
        code: 'CREATOR_REFERENCE_UNSUPPORTED',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} visibly contains a person or creator. Cinematic Product Ad requires isolated product-only photos; use source-locked image motion, or a consented creator workflow with separate product evidence.`,
      })
      continue
    }

    const width = Math.max(0, Number(asset.width || 0))
    const height = Math.max(0, Number(asset.height || 0))
    if (Math.min(width, height) < 720 || Math.max(width, height) < 1024) {
      issues.push({
        code: 'RESOLUTION_REQUIRED',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} needs at least a 720px short edge and a 1024px long edge.`,
      })
      continue
    }
    if (analysis.qualityScore < 70) {
      issues.push({
        code: 'QUALITY_TOO_LOW',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} scored ${analysis.qualityScore}/100; 70/100 is required before paid video production.`,
      })
      continue
    }

    const sourceRisks = [...analysis.qualityIssues, ...analysis.evidenceLimits]
    if (sourceRisks.some(item => UNSAFE_GRAPHIC_PATTERN.test(item))) {
      issues.push({
        code: 'UNSAFE_SOURCE_GRAPHICS',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} contains source graphics that make cinematic generation unreliable.`,
      })
      continue
    }

    if (analysis.visibleText.length > 0) {
      warnings.push(`${asset.fileName || 'Reference'} contains product text; NEXUS will verify label fidelity before attachment.`)
    }
    productLists.push(analysis.products.length > 0
      ? analysis.products
      : [analysis.visibleSummary, ...analysis.visibleObjects])
    qualifiedAssetIds.push(asset.id)
  }

  if (
    qualifiedAssetIds.length >= CINEMATIC_PRODUCT_AD_MIN_REFERENCES
    && !hasSharedProductIdentity(productLists)
  ) {
    issues.push({
      code: 'PRODUCT_IDENTITY_MISMATCH',
      message: 'The selected angles are not confidently identified as the same product. Analyse clearer angles or select a consistent set.',
    })
  }

  const eligible = issues.length === 0
    && qualifiedAssetIds.length >= CINEMATIC_PRODUCT_AD_MIN_REFERENCES

  return {
    eligible,
    route: eligible
      ? 'CINEMATIC_PRODUCT_AD'
      : motionDesignRequired
        ? 'MOTION_DESIGN_REQUIRED'
        : 'BLOCKED',
    issues,
    warnings: Array.from(new Set(warnings)),
    qualifiedAssetIds,
  }
}
