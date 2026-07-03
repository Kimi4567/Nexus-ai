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
  outputClassification: 'draft_composition_plan'
  reviewStatus: 'review_only'
  availableActions: []
  boundaryCopy: {
    en: string
    ar: string
  }
  notFinalAdCreative: true
  notAttachedToPost: true
  notRenderedOrExported: true
  planCopy: {
    en: string
    ar: string
  }
}

export type CreativeCompositionPreviewCandidateResult = {
  candidate: CreativeCompositionPreviewCandidate | null
  emptyStateCopy: {
    en: string
    ar: string
  }
}

const REVIEW_ONLY_BOUNDARY_COPY = {
  en: 'Composition plan for review only. It is a planning blueprint for future editable layers, not a rendered ad, not attached to posts, and final media decisions remain in Content Hub.',
  ar: 'خطة تركيب إبداعي للمراجعة فقط. هي خطة للطبقات القابلة للتعديل لاحقًا، وليست تصميمًا إعلانيًا مُصدّرًا، وليست مرتبطة بالمنشورات، وتبقى قرارات الوسائط النهائية في Content Hub.',
}

const PLAN_COPY = {
  en: 'This is a planning blueprint for future editable layers. It is not a rendered ad, not attached to the post, and not final creative.',
  ar: 'هذه خطة للطبقات القابلة للتعديل لاحقًا. ليست تصميمًا إعلانيًا مُصدّرًا، وليست مرتبطة بالمنشور، وليست نسخة نهائية.',
}

const EMPTY_STATE_COPY = {
  en: 'No composition plan yet. A confirmed post background is needed before showing the layer blueprint.',
  ar: 'لا توجد خطة تركيب بعد. يلزم وجود خلفية منشور مؤكدة قبل عرض مخطط الطبقات.',
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
    outputClassification: 'draft_composition_plan',
    reviewStatus: 'review_only',
    availableActions: [],
    boundaryCopy: REVIEW_ONLY_BOUNDARY_COPY,
    notFinalAdCreative: true,
    notAttachedToPost: true,
    notRenderedOrExported: true,
    planCopy: PLAN_COPY,
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
