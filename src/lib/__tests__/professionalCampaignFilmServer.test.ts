import { describe, expect, it } from 'vitest'
import {
  buildProfessionalCampaignFilmFfmpegArgs,
  professionalCampaignFilmOverlaySvgs,
} from '../professionalCampaignFilm.server'

describe('professional campaign film compositor', () => {
  it('builds separate Arabic hook, benefit, and end-frame overlays', () => {
    const overlays = professionalCampaignFilmOverlaySvgs({
      brand: 'NOORAYA',
      hook: 'أناقة تتحرك معك',
      benefit: 'تفاصيل تصنع الفارق',
      cta: 'اكتشفي المزيد',
      language: 'ar',
    })

    expect(overlays.hook).toContain('direction="rtl"')
    expect(overlays.hook).toContain('NOORAYA')
    expect(overlays.benefit).toContain('تفاصيل')
    expect(overlays.end).toContain('اكتشفي')
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
