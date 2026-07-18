export const CONTENT_HUB_UPLOADED_MEDIA_SOURCE = 'UPLOAD_RAW'

export type ContentHubMediaStateKey =
  | 'no_media'
  | 'uploaded_ready'
  | 'generated_ready'
  | 'ambiguous_preview_pending'
  | 'generic_post_media'

export type ContentHubMediaStateInput = {
  imageUrl?: string | null
  uploadedMediaId?: string | null
  mediaSource?: string | null
  generationStatus?: string | null
}

export type ContentHubMediaState = {
  key: ContentHubMediaStateKey
  countsAsReady: boolean
  needsAttention: boolean
  hasPreview: boolean
  badgeLabel: {
    en: string
    ar: string
  }
  explanatoryCopy: {
    en: string
    ar: string
  }
}

export type ContentHubMediaReadinessSummary = {
  total: number
  confirmedReady: number
  ambiguousPreviewCount: number
  needsAttentionCount: number
}

function normalize(value?: string | null): string {
  return (value ?? '').trim().toUpperCase()
}

export function deriveContentHubMediaState(input: ContentHubMediaStateInput): ContentHubMediaState {
  const imageUrl = (input.imageUrl ?? '').trim()
  const hasPreview = imageUrl.length > 0
  const isVideoPreview = /\.(mp4|mov|webm|m4v)(?:\?|$)/i.test(imageUrl)
  const generationStatus = normalize(input.generationStatus)
  const mediaSource = normalize(input.mediaSource)
  const hasUploadedMedia = Boolean(input.uploadedMediaId)

  if (!hasPreview) {
    return {
      key: 'no_media',
      countsAsReady: false,
      needsAttention: true,
      hasPreview: false,
      badgeLabel: { en: 'No media', ar: 'لا توجد وسائط' },
      explanatoryCopy: {
        en: 'No media is linked yet. This post still needs a media decision.',
        ar: 'لا توجد وسائط مرتبطة بعد. يحتاج هذا المنشور إلى قرار وسائط.',
      },
    }
  }

  if (
    hasUploadedMedia &&
    generationStatus === 'DONE' &&
    (mediaSource === CONTENT_HUB_UPLOADED_MEDIA_SOURCE || mediaSource === 'UPLOAD' || mediaSource === '')
  ) {
    return {
      key: 'uploaded_ready',
      countsAsReady: true,
      needsAttention: false,
      hasPreview: true,
      badgeLabel: { en: 'Uploaded asset', ar: 'أصل مرفوع' },
      explanatoryCopy: {
        en: 'Uploaded media is linked and confirmed ready for this post preview.',
        ar: 'تم ربط وسائط مرفوعة وتأكيد جاهزيتها لمعاينة هذا المنشور.',
      },
    }
  }

  if (mediaSource === 'GENERATE' && generationStatus === 'DONE') {
    return {
      key: 'generated_ready',
      countsAsReady: true,
      needsAttention: false,
      hasPreview: true,
      badgeLabel: isVideoPreview
        ? { en: 'Generated video', ar: 'فيديو مولّد' }
        : { en: 'Generated image', ar: 'صورة مولّدة' },
      explanatoryCopy: {
        en: isVideoPreview
          ? 'Generated video is confirmed ready for this post preview.'
          : 'Generated image is confirmed ready for this post preview.',
        ar: isVideoPreview
          ? 'تم تأكيد جاهزية الفيديو المولّد لمعاينة هذا المنشور.'
          : 'تم تأكيد جاهزية الصورة المولّدة لمعاينة هذا المنشور.',
      },
    }
  }

  if (generationStatus !== 'DONE') {
    return {
      key: 'ambiguous_preview_pending',
      countsAsReady: false,
      needsAttention: true,
      hasPreview: true,
      badgeLabel: {
        en: 'Media preview — readiness pending',
        ar: 'معاينة وسائط — الجاهزية قيد التأكيد',
      },
      explanatoryCopy: {
        en: 'A media preview is visible, but it is not counted ready until generation or attachment status is confirmed.',
        ar: 'توجد معاينة وسائط، لكنها لا تُحتسب جاهزة حتى يتم تأكيد حالة التوليد أو الربط.',
      },
    }
  }

  return {
    key: 'generic_post_media',
    countsAsReady: true,
    needsAttention: false,
    hasPreview: true,
    badgeLabel: { en: 'Post media', ar: 'وسائط المنشور' },
    explanatoryCopy: {
      en: 'Post media is linked and readiness is confirmed.',
      ar: 'وسائط المنشور مرتبطة وتم تأكيد جاهزيتها.',
    },
  }
}

/**
 * Scheduling is an execution-readiness state, so a post may enter it only when
 * its final linked media is confirmed ready. Keep this shared between the UI
 * and API so a client cannot bypass the media review gate.
 */
export function isContentPostMediaReadyForScheduling(
  input: ContentHubMediaStateInput,
): boolean {
  return deriveContentHubMediaState(input).countsAsReady
}

export function summarizeContentHubMediaReadiness(
  posts: ContentHubMediaStateInput[],
): ContentHubMediaReadinessSummary {
  return posts.reduce<ContentHubMediaReadinessSummary>((summary, post) => {
    const state = deriveContentHubMediaState(post)
    summary.total += 1
    if (state.countsAsReady) summary.confirmedReady += 1
    if (state.key === 'ambiguous_preview_pending') summary.ambiguousPreviewCount += 1
    if (state.needsAttention) summary.needsAttentionCount += 1
    return summary
  }, {
    total: 0,
    confirmedReady: 0,
    ambiguousPreviewCount: 0,
    needsAttentionCount: 0,
  })
}
