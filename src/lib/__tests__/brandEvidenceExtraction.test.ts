import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

vi.mock('server-only', () => ({}))

describe('brand evidence document extraction', () => {
  it('extracts PowerPoint text in slide order with stable slide locators', async () => {
    const archive = new JSZip()
    archive.file('ppt/slides/slide2.xml', '<p:sld><a:t>Second &amp; final</a:t><a:t>result &#x32;40</a:t></p:sld>')
    archive.file('ppt/slides/slide1.xml', '<p:sld><a:t>First claim</a:t><a:t>AED 120</a:t></p:sld>')
    archive.file('ppt/notesSlides/notesSlide1.xml', '<a:t>Private speaker note</a:t>')
    const bytes = await archive.generateAsync({ type: 'arraybuffer' })
    const { extractBrandEvidenceText } = await import('@/lib/brandEvidenceExtraction.server')

    const result = await extractBrandEvidenceText(
      bytes,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )

    expect(result.text).toBe('[Slide 1]\nFirst claim AED 120\n\n[Slide 2]\nSecond & final result 240')
    expect(result.text).not.toContain('Private speaker note')
    expect(result.metadata).toEqual({ parser: 'jszip-pptx', totalSlides: 2, truncated: false })
  })

  it('rejects archives without readable slides instead of pretending extraction succeeded', async () => {
    const archive = new JSZip()
    archive.file('docProps/app.xml', '<Properties />')
    const bytes = await archive.generateAsync({ type: 'arraybuffer' })
    const { extractBrandEvidenceText } = await import('@/lib/brandEvidenceExtraction.server')

    await expect(extractBrandEvidenceText(
      bytes,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )).rejects.toThrow('invalid_powerpoint_document')
  })
})
