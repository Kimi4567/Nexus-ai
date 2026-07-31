import { execFile } from 'node:child_process'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  buildMotionDesignFfmpegArgs,
  professionalMotionDesignOverlaySvgs,
} from '@/lib/motionDesignAd.server'
import { resolvePlatformVideoFormat } from '@/lib/platformVideoFormat'
import { buildProfessionalVideoTimeline } from '@/lib/professionalVideoTimeline'
import { buildMotionDesignCopy } from '@/lib/motionDesignAd'

const execFileAsync = promisify(execFile)
const source = process.env.NEXUS_VISUAL_FIXTURE_SOURCE
const output = process.env.NEXUS_VISUAL_FIXTURE_OUTPUT
const variant = process.env.NEXUS_VISUAL_FIXTURE_VARIANT === 'DELIVERY'
  ? 'DELIVERY'
  : process.env.NEXUS_VISUAL_FIXTURE_VARIANT === 'SERVICE_REVIEW'
    ? 'SERVICE_REVIEW'
  : process.env.NEXUS_VISUAL_FIXTURE_VARIANT === 'SERVICE'
    ? 'SERVICE'
    : 'SUBSCRIPTION'

describe('professional motion-design visual fixture', () => {
  it.runIf(Boolean(source && output))('renders a local review master without external services', async () => {
    const delivery = variant === 'DELIVERY'
    const service = variant === 'SERVICE' || variant === 'SERVICE_REVIEW'
    const caption = variant === 'SERVICE_REVIEW'
      ? 'وسطاء العقارات في دبي، ابدأوا بمراجعة مسودات حملاتكم العقارية خطوة بخطوة. أرسلوا لنا صور وبيانات عقاراتكم لتحصلوا على محتوى مخصص.'
      : service
      ? 'وسطاء العقارات، هل تواجهون تحديات في تنظيم حملاتكم التسويقية؟ 📊 دعونا نحوّل صور عقاراتكم إلى مسودات محتوى قابلة للمراجعة! استراتيجيات مدروسة تبنيها على بياناتكم. #تسويق_عقاري #دبي #حملات_تسويقية'
      : delivery
        ? 'داخل دبي فقط خلال 48 ساعة. راجع عنوان التوصيل وتفاصيل الاشتراك قبل الطلب.'
        : 'كيلوغرام واحد شهريًا مقابل 149 درهمًا. القهوة محمصة حديثًا. التوصيل داخل دبي فقط خلال 48 ساعة. راجع تفاصيل الاشتراك قبل الطلب.'
    const timeline = buildProfessionalVideoTimeline({
      copy: buildMotionDesignCopy({
        brandName: service ? 'Aster Property Marketing' : 'Luma Roast Lab',
        caption,
      }),
      caption,
      colorPalette: ['#17120F', '#F6F0E8', '#E7A85A'],
      sourceMatchesTarget: false,
      sourceLayout: 'FULL_BLEED',
    })
    const target = resolvePlatformVideoFormat('INSTAGRAM')
    const workDir = await mkdtemp(path.join(tmpdir(), 'nexus-v3-fixture-'))
    try {
      const overlays = await professionalMotionDesignOverlaySvgs({
        timeline,
        width: target.width,
        height: target.height,
      })
      const intro = path.join(workDir, 'intro.png')
      const hook = path.join(workDir, 'hook.png')
      const end = path.join(workDir, 'end.png')
      await Promise.all([
        sharp(Buffer.from(overlays.intro)).png().toFile(intro),
        sharp(Buffer.from(overlays.hook)).png().toFile(hook),
        sharp(Buffer.from(overlays.end)).png().toFile(end),
      ])
      await execFileAsync(ffmpegPath!, buildMotionDesignFfmpegArgs({
        sourcePath: source!,
        introOverlayPath: intro,
        hookOverlayPath: hook,
        endOverlayPath: end,
        outputPath: output!,
        target,
        timeline,
        sourceWidth: 2560,
        sourceHeight: 1440,
      }), { timeout: 120_000, maxBuffer: 1024 * 1024 })
      expect((await stat(output!)).size).toBeGreaterThan(0)
    } finally {
      await rm(workDir, { recursive: true, force: true })
    }
  }, 120_000)
})
