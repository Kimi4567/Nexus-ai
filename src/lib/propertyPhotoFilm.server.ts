import { createElement, type CSSProperties } from 'react'
import {
  generateElevenLabsSpeech,
  isElevenLabsVoiceoverConfigured,
} from '@/lib/ai/elevenlabs'
import {
  buildShotstackPropertyPhotoFilmEdit,
  isShotstackProductionConfigured,
  renderShotstackEdit,
} from '@/lib/ai/shotstack'
import type { PlatformVideoFormat } from '@/lib/platformVideoFormat'
import type { PropertyPhotoFilmCopy } from '@/lib/propertyPhotoFilm'
import { PROPERTY_PHOTO_FILM_DURATION_SECONDS } from '@/lib/propertyPhotoFilm'
import {
  NEXUS_ARABIC_FONT_FAMILY,
  renderPathOnlyVideoOverlay as renderPathOnlyOverlay,
  videoOverlayInlineText as inlineText,
  videoOverlayTextLines as textLines,
  visualVideoOverlayText as visualText,
  wrapVideoOverlayText as wrapText,
} from '@/lib/videoOverlayTypography.server'
import {
  normalizeCampaignFilmVoiceover,
  persistRemoteCampaignFilm,
  uploadVoiceoverToCloudinary,
  type ProfessionalCampaignFilmCompositorUsage,
  type StoredProfessionalCampaignFilm,
} from '@/lib/professionalCampaignFilm.server'

export type PropertyPhotoFilmPendingCompositor = {
  renderId: string
  voiceover: ProfessionalCampaignFilmCompositorUsage['voiceover']
}

function propertyVoiceoverScript(copy: PropertyPhotoFilmCopy): string {
  const separator = copy.language === 'ar' ? '، ' : '. '
  return [copy.hook, copy.detail, copy.cta]
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
    .join(separator)
    .slice(0, 240)
}

function disclosureElement(copy: PropertyPhotoFilmCopy, rtl: boolean) {
  if (!copy.disclosure) return null
  return createElement('div', {
    style: {
      display: 'flex',
      alignSelf: rtl ? 'flex-end' : 'flex-start',
      borderRadius: 18,
      backgroundColor: 'rgba(5, 15, 15, 0.78)',
      color: '#FFFFFF',
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: 17,
      fontWeight: 700,
      letterSpacing: rtl ? 0 : 2,
      padding: '9px 15px',
      whiteSpace: 'pre',
    },
  }, visualText(copy.disclosure, rtl))
}

export async function propertyPhotoFilmOverlaySvgs(input: {
  copy: PropertyPhotoFilmCopy
  width: number
  height: number
}): Promise<{ intro: string; detail: string; end: string }> {
  const { copy, width, height } = input
  const rtl = copy.language === 'ar'
  const root: CSSProperties = {
    width,
    height,
    display: 'flex',
    fontFamily: NEXUS_ARABIC_FONT_FAMILY,
  }
  const brand = createElement('div', {
    style: {
      display: 'flex',
      color: '#FFFFFF',
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: rtl ? 0 : 3.5,
      whiteSpace: 'pre',
    },
  }, visualText(copy.brand.toUpperCase(), rtl))
  const eyebrow = createElement('div', {
    style: {
      display: 'flex',
      color: '#BFD9D1',
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: rtl ? 0 : 4,
      marginBottom: 24,
      whiteSpace: 'pre',
    },
  }, visualText(copy.eyebrow, rtl))

  const intro = await renderPathOnlyOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '56px 58px 126px',
      backgroundImage: 'linear-gradient(to bottom, rgba(4,14,14,0.68) 0%, rgba(4,14,14,0) 32%, rgba(4,14,14,0) 48%, rgba(4,14,14,0.88) 100%)',
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: rtl ? 'flex-end' : 'flex-start',
      gap: 18,
    },
  }, brand, disclosureElement(copy, rtl)),
  createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: rtl ? 'flex-end' : 'flex-start',
    },
  }, eyebrow, textLines(wrapText(copy.hook, rtl ? 17 : 22), {
    rtl,
    size: 52,
    color: '#FFFFFF',
  }))), width, height)

  const detail = await renderPathOnlyOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: rtl ? 'flex-end' : 'flex-start',
      padding: '0 54px 134px',
      backgroundImage: 'linear-gradient(to bottom, rgba(4,14,14,0) 55%, rgba(4,14,14,0.83) 100%)',
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      width: 94,
      height: 3,
      marginBottom: 30,
      backgroundColor: '#BFD9D1',
    },
  }),
  textLines(wrapText(copy.detail, rtl ? 22 : 30), {
    rtl,
    size: 38,
    color: '#FFFFFF',
  })), width, height)

  const end = await renderPathOnlyOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '54px 58px 92px',
      backgroundImage: 'linear-gradient(to bottom, rgba(4,14,14,0.74) 0%, rgba(4,14,14,0.08) 38%, rgba(4,14,14,0.88) 100%)',
    },
  },
  disclosureElement(copy, rtl),
  createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: rtl ? 'flex-end' : 'flex-start',
    },
  },
  brand,
  createElement('div', {
    style: {
      display: 'flex',
      width: 120,
      height: 2,
      margin: '28px 0 30px',
      backgroundColor: '#BFD9D1',
    },
  }),
  inlineText(copy.cta, {
    rtl,
    size: 38,
    color: '#FFFFFF',
  }))), width, height)

  return { intro, detail, end }
}

export async function renderAndPersistPropertyPhotoFilm(input: {
  sourceImageUrls: string[]
  target: PlatformVideoFormat
  generationId: string
  copy: PropertyPhotoFilmCopy
  resumeCompositor?: PropertyPhotoFilmPendingCompositor | null
  onCompositorQueued?: (pending: PropertyPhotoFilmPendingCompositor) => void | Promise<void>
}): Promise<StoredProfessionalCampaignFilm> {
  if (!isShotstackProductionConfigured()) {
    throw new Error('SHOTSTACK_PROPERTY_FILM_UNAVAILABLE')
  }

  const overlays = await propertyPhotoFilmOverlaySvgs({
    copy: input.copy,
    width: input.target.width,
    height: input.target.height,
  })
  const voiceover = !input.resumeCompositor && isElevenLabsVoiceoverConfigured(input.copy.language)
    ? await generateElevenLabsSpeech({
        text: propertyVoiceoverScript(input.copy),
        language: input.copy.language,
      })
    : null
  const voiceoverUsage: ProfessionalCampaignFilmCompositorUsage['voiceover'] = voiceover
    ? {
        provider: 'elevenlabs',
        modelId: voiceover.modelId,
        voiceId: voiceover.voiceId,
        characters: voiceover.characters,
        characterCost: voiceover.characterCost,
        estimatedCostUsd: voiceover.estimatedCostUsd,
        requestId: voiceover.requestId,
      }
    : input.resumeCompositor?.voiceover ?? null
  const normalizedVoiceover = voiceover
    ? await normalizeCampaignFilmVoiceover(voiceover.audio)
    : null
  const voiceoverUrl = normalizedVoiceover
    ? await uploadVoiceoverToCloudinary(normalizedVoiceover, `property_${input.generationId}`)
    : null
  const edit = buildShotstackPropertyPhotoFilmEdit({
    sourceImageUrls: input.sourceImageUrls,
    target: input.target,
    durationSeconds: PROPERTY_PHOTO_FILM_DURATION_SECONDS,
    overlays,
    voiceoverUrl,
  })
  const render = await renderShotstackEdit(edit, {
    environment: 'v1',
    renderId: input.resumeCompositor?.renderId,
    onQueued: renderId => input.onCompositorQueued?.({
      renderId,
      voiceover: voiceoverUsage,
    }),
  })
  const stored = await persistRemoteCampaignFilm(render.url, `property_${input.generationId}`)
  return {
    ...stored,
    compositorUsage: {
      provider: 'shotstack',
      environment: 'v1',
      estimatedCostUsd: render.estimatedCostUsd,
      estimatedCredits: render.estimatedCredits,
      renderId: render.id,
      voiceover: voiceoverUsage,
    },
  }
}
