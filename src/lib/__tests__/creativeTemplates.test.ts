import { describe, expect, it } from 'vitest'
import {
  deriveCreativeQualityChecklist,
  getCreativeTemplatesForRequirement,
  getDefaultTemplateForPlatform,
  validateCreativeTemplateSpec,
} from '../creativeTemplates'

describe('creative template contract', () => {
  it('provides a Meta portrait feed template with 4:5 and 1080x1350 dimensions', () => {
    const template = getDefaultTemplateForPlatform('META')

    expect(template.platform).toBe('META')
    expect(template.format).toBe('feed_portrait')
    expect(template.aspectRatio).toBe('4:5')
    expect(template.width).toBe(1080)
    expect(template.height).toBe(1350)
  })

  it('provides a LinkedIn landscape template with 1.91:1 and 1200x628 dimensions', () => {
    const template = getDefaultTemplateForPlatform('LINKEDIN')

    expect(template.platform).toBe('LINKEDIN')
    expect(template.format).toBe('linkedin_landscape')
    expect(template.aspectRatio).toBe('1.91:1')
    expect(template.width).toBe(1200)
    expect(template.height).toBe(628)
  })

  it('keeps headline and CTA layers editable text layers', () => {
    const template = getDefaultTemplateForPlatform('META')
    const headline = template.layers.find(layer => layer.type === 'headline')
    const cta = template.layers.find(layer => layer.type === 'cta')

    expect(headline).toMatchObject({
      type: 'headline',
      editable: true,
      contentSource: 'social_post',
    })
    expect(cta).toMatchObject({
      type: 'cta',
      editable: true,
      contentSource: 'user_editable',
    })
  })

  it('keeps the background as a non-text generated/uploaded layer', () => {
    const template = getDefaultTemplateForPlatform('META')
    const background = template.layers.find(layer => layer.type === 'background')

    expect(background).toMatchObject({
      type: 'background',
      editable: false,
      contentSource: 'generated_asset',
    })
    expect(background?.type).not.toBe('headline')
    expect(background?.type).not.toBe('cta')
  })

  it('requires safe zones on default templates', () => {
    const meta = getDefaultTemplateForPlatform('META')
    const linkedIn = getDefaultTemplateForPlatform('LINKEDIN')

    expect(meta.safeZones).toEqual(expect.objectContaining({
      top: expect.any(Number),
      right: expect.any(Number),
      bottom: expect.any(Number),
      left: expect.any(Number),
    }))
    expect(linkedIn.safeZones.top).toBeGreaterThan(0)
    expect(validateCreativeTemplateSpec(meta).ok).toBe(true)
    expect(validateCreativeTemplateSpec(linkedIn).ok).toBe(true)
  })

  it('falls back to a generic square template for unknown platforms', () => {
    const template = getDefaultTemplateForPlatform('MASTODON')

    expect(template.platform).toBe('UNKNOWN')
    expect(template.format).toBe('feed_square')
    expect(template.aspectRatio).toBe('1:1')
    expect(template.width).toBe(1080)
    expect(template.height).toBe(1080)
  })

  it('catches a missing required layer during validation', () => {
    const template = getDefaultTemplateForPlatform('META')
    template.layers = template.layers.filter(layer => layer.type !== 'headline')

    const result = validateCreativeTemplateSpec(template)

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Missing required headline layer/)
  })

  it('includes quality rules for avoiding AI-rendered text', () => {
    const checklist = deriveCreativeQualityChecklist(getDefaultTemplateForPlatform('META'))

    const rule = checklist.find(item => item.id === 'avoid_ai_rendered_text')
    expect(rule).toBeTruthy()
    expect(`${rule?.label} ${rule?.explanation}`).toMatch(/AI-rendered text/i)
    expect(rule?.severity).toBe('required')
    expect(rule?.passedByDefault).toBe(true)
  })

  it('includes Content Hub as the final attachment source-of-truth boundary', () => {
    const checklist = deriveCreativeQualityChecklist(getDefaultTemplateForPlatform('META'))

    const rule = checklist.find(item => item.id === 'content_hub_final_attachment_boundary')
    expect(rule).toBeTruthy()
    expect(rule?.explanation).toMatch(/Content Hub/)
    expect(rule?.explanation).toMatch(/Final attachment/)
    expect(rule?.passedByDefault).toBe(true)
  })

  it('returns platform-fit templates for a CreativeRequirement-compatible input', () => {
    const templates = getCreativeTemplatesForRequirement({
      platform: 'LINKEDIN',
      aspectRatio: '1.91:1',
      funnelStage: 'Scheduled execution',
      logoNeeded: true,
    })

    expect(templates.length).toBeGreaterThan(0)
    expect(templates[0]).toMatchObject({
      platform: 'LINKEDIN',
      aspectRatio: '1.91:1',
      width: 1200,
      height: 628,
    })
  })
})
