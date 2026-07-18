import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import {
  buildProfessionalCampaignFilmFfmpegArgs,
  professionalCampaignFilmOverlaySvgs,
} from '../professionalCampaignFilm.server'

describe('professional campaign film compositor', () => {
  it('builds separate Arabic hook, benefit, and end-frame overlays', async () => {
    const overlays = professionalCampaignFilmOverlaySvgs({
      brand: 'NOORAYA',
      hook: 'أناقة تتحرك معك',
      benefit: 'تفاصيل تصنع الفارق',
      cta: 'اكتشفي المزيد',
      language: 'ar',
    })

    expect(overlays.hook).toContain('direction="rtl"')
    expect(overlays.hook).toContain("@font-face")
    expect(overlays.hook).toContain("font-family:'NEXUS Tajawal'")
    expect(overlays.hook).toContain('text-anchor="start"')
    expect(overlays.hook).toContain('NOORAYA')
    expect(overlays.benefit).toContain('تفاصيل')
    expect(overlays.end).toContain('اكتشفي')
    expect(overlays.end).toContain('x="360" y="832" text-anchor="middle"')

    const { data, info } = await sharp(Buffer.from(overlays.end))
      .raw()
      .toBuffer({ resolveWithObject: true })
    let darkCtaPixels = 0
    for (let y = 770; y < 860; y += 1) {
      for (let x = 165; x < 555; x += 1) {
        const offset = (y * info.width + x) * info.channels
        const red = data[offset]
        const green = data[offset + 1]
        const blue = data[offset + 2]
        if (red < 80 && green < 80 && blue < 80) darkCtaPixels += 1
      }
    }
    expect(darkCtaPixels).toBeGreaterThan(500)
  })

  it('preserves generated audio and creates three intentional copy phases', () => {
    const args = buildProfessionalCampaignFilmFfmpegArgs({
      sourcePath: '/tmp/source.mp4',
      hookOverlayPath: '/tmp/hook.png',
      benefitOverlayPath: '/tmp/benefit.png',
      endOverlayPath: '/tmp/end.png',
      outputPath: '/tmp/output.mp4',
      target: {
        platform: 'TIKTOK',
        width: 720,
        height: 1280,
        aspectRatio: '9:16',
        ratio: '720:1280',
        format: 'Vertical short-form video',
        durationSeconds: 10,
      },
    })

    expect(args).toContain('0:a?')
    expect(args.join(' ')).toContain("between(t,0,2.8)")
    expect(args.join(' ')).toContain("between(t,3.0,6.6)")
    expect(args.join(' ')).toContain("between(t,7.5,10.0)")
    expect(args.join(' ')).toContain("(0.48-t)*-250")
    expect(args.join(' ')).toContain("(3.45-t)*120")
  })
})
