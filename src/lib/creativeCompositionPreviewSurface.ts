import { deriveContentHubMediaState, type ContentHubMediaStateKey } from './contentHubMediaState'

export type CreativeCompositionPreviewCandidatePost = {
  id: string
  platform?: string | null
  caption?: string | null
  imageUrl?: string | null
  uploadedMediaId?: string | null
  mediaSource?: string | null
  generationStatus?: string | null
}

export type CreativeCompositionPreviewCandidate = {
  post: CreativeCompositionPreviewCandidatePost
  mediaStateKey: Extract<ContentHubMediaStateKey, 'generated_ready' | 'uploaded_ready'>
  backgroundSource: 'generated_background' | 'uploaded_asset'
  outputClassification: 'draft_composition_preview'
  reviewStatus: 'review_only'
  availableActions: []
  boundaryCopy: {
    en: string
    ar: string
  }
  notFinalAdCreative: true
  notAttachedToPost: true
}

export type CreativeCompositionPreviewCandidateResult = {
  candidate: CreativeCompositionPreviewCandidate | null
  emptyStateCopy: {
    en: string
    ar: string
  }
}

const REVIEW_ONLY_BOUNDARY_COPY = {
  en: 'Review-only draft composition preview. It is not final ad creative, not attached to posts, and final media decisions remain in Content Hub.',
  ar: 'معاينة تركيب إبداعي للمراجعة فقط. ليست تصميمًا إعلانيًا نهائيًا، وليست مرتبطة بالمنشورات، وتبقى قرارات الوسائط النهائية في Content Hub.',
}

const EMPTY_STATE_COPY = {
  en: 'No draft composition preview yet. A confirmed post background is needed before previewing composition.',
  ar: 'لا توجد معاينة تركيب بعد. يلزم وجود خلفية منشور مؤكدة قبل معاينة التركيب.',
}

function candidateFromPost(
  post: CreativeCompositionPreviewCandidatePost,
): CreativeCompositionPreviewCandidate | null {
  const mediaState = deriveContentHubMediaState(post)
  if (mediaState.key !== 'generated_ready' && mediaState.key !== 'uploaded_ready') return null

  return {
    post,
    mediaStateKey: mediaState.key,
    backgroundSource: mediaState.key === 'uploaded_ready' ? 'uploaded_asset' : 'generated_background',
    outputClassification: 'draft_composition_preview',
    reviewStatus: 'review_only',
    availableActions: [],
    boundaryCopy: REVIEW_ONLY_BOUNDARY_COPY,
    notFinalAdCreative: true,
    notAttachedToPost: true,
  }
}

export function deriveCreativeCompositionPreviewCandidate(
  posts: CreativeCompositionPreviewCandidatePost[],
): CreativeCompositionPreviewCandidateResult {
  const candidates = posts
    .map(candidateFromPost)
    .filter((candidate): candidate is CreativeCompositionPreviewCandidate => Boolean(candidate))

  const generatedCandidate = candidates.find(candidate => candidate.mediaStateKey === 'generated_ready')
  return {
    candidate: generatedCandidate || candidates[0] || null,
    emptyStateCopy: EMPTY_STATE_COPY,
  }
}
