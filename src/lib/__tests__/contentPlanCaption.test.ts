/**
 * Trust Sprint #4 — content-plan caption integrity.
 *
 * The bug: video slots return `videoCaption` (not `caption`), so the old
 * fallthrough shipped "Post N for Facebook / Instagram" (a generic ENGLISH
 * placeholder) on every video post — even in Arabic campaigns. resolvePostCaption
 * must produce real copy for every slot and, only as a last resort, language-aware
 * brand copy — never a placeholder.
 */

import { describe, it, expect } from 'vitest'
import { resolvePostCaption } from '@/lib/contentPlanCaption'

const arOpts = { isArabic: true, brand: 'عيادة ابتسامة', hint: 'احصل على ابتسامة مشرقة' }
const enOpts = { isArabic: false, brand: 'SmileClinic', hint: 'Get a brighter smile' }

const PLACEHOLDER = /Post \d+ for|Facebook \/ Instagram/i

describe('resolvePostCaption', () => {
  it('3. video slots use videoCaption (no caption field present)', () => {
    const gen = { videoCaption: 'شاهد الفيديو الجديد من عيادتنا', videoScript: 'سكربت الفيديو' }
    expect(resolvePostCaption(gen, arOpts)).toBe('شاهد الفيديو الجديد من عيادتنا')
  })

  it('5. non-video posts use caption (mapping unaffected)', () => {
    const gen = { caption: 'منشور تعليمي عن صحة الأسنان #صحة_الفم', imagePrompt: 'dental clinic' }
    expect(resolvePostCaption(gen, arOpts)).toBe('منشور تعليمي عن صحة الأسنان #صحة_الفم')
  })

  it('2 & 4. missing caption in an Arabic campaign → useful Arabic copy, NEVER an English placeholder', () => {
    const out = resolvePostCaption({}, arOpts)
    expect(out).not.toMatch(PLACEHOLDER)
    expect(out).toContain('عيادة ابتسامة')          // brand
    expect(out).toContain('احصل على ابتسامة مشرقة')  // hint
    expect(/[؀-ۿ]/.test(out)).toBe(true)   // contains Arabic
  })

  it('missing caption with empty hint still returns useful Arabic copy (no placeholder)', () => {
    const out = resolvePostCaption({}, { isArabic: true, brand: 'عيادتي', hint: '' })
    expect(out).not.toMatch(PLACEHOLDER)
    expect(out).toContain('عيادتي')
    expect(/[؀-ۿ]/.test(out)).toBe(true)
  })

  it('English campaign missing caption → English brand fallback (not Arabic, not placeholder)', () => {
    const out = resolvePostCaption({}, enOpts)
    expect(out).toContain('SmileClinic')
    expect(out).not.toMatch(PLACEHOLDER)
  })

  it('treats whitespace-only / non-string captions as missing', () => {
    expect(resolvePostCaption({ caption: '   ' }, arOpts)).not.toBe('   ')
    expect(resolvePostCaption({ caption: '   ' }, arOpts)).not.toMatch(PLACEHOLDER)
    expect(resolvePostCaption({ caption: 123 as unknown }, arOpts)).not.toMatch(PLACEHOLDER)
  })

  it('prefers caption over videoCaption when both are present', () => {
    expect(resolvePostCaption({ caption: 'الكابشن الأساسي', videoCaption: 'كابشن الفيديو' }, arOpts))
      .toBe('الكابشن الأساسي')
  })
})
