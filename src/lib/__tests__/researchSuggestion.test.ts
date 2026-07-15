import { describe, expect, it } from 'vitest'
import {
  getResearchSuggestionView,
  isResearchMonitorPayload,
} from '@/lib/researchSuggestion'

describe('research suggestion view', () => {
  it('exposes safe source links and keeps automatic learning false', () => {
    const view = getResearchSuggestionView({
      source: 'market-research-monitor',
      researchKind: 'competitor',
      titleAr: 'بحث المنافسين',
      reasoningAr: 'راجع المصدر قبل استخدامه.',
      autoLearningApplied: true,
      items: [
        { title: 'Launch story', url: 'https://example.com/story', source: 'Example News' },
        { title: 'Duplicate', url: 'https://example.com/story' },
        { title: 'Unsafe', url: 'javascript:alert(1)' },
      ],
    })

    expect(view.research).toEqual({
      kind: 'competitor',
      items: [{
        title: 'Launch story',
        url: 'https://example.com/story',
        source: 'Example News',
        publishedAt: '',
      }],
      autoLearningApplied: false,
    })
    expect(view.titleAr).toBe('بحث المنافسين')
  })

  it('does not classify normal operational suggestions as research', () => {
    expect(isResearchMonitorPayload({ source: 'execution-monitor' })).toBe(false)
    expect(getResearchSuggestionView({ source: 'execution-monitor' }).research).toBeNull()
  })
})
