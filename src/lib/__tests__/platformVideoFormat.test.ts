import { describe, expect, it } from 'vitest'
import {
  resolvePlatformVideoFormat,
  validatePlatformVideoFormat,
} from '@/lib/platformVideoFormat'

describe('platform video delivery contract', () => {
  it.each(['META', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'PINTEREST'])(
    'uses a vertical 9:16 master for %s',
    (platform) => {
      expect(resolvePlatformVideoFormat(platform)).toMatchObject({
        aspectRatio: '9:16',
        width: 720,
        height: 1280,
        ratio: '720:1280',
      })
    },
  )

  it.each(['LINKEDIN', 'X', 'GOOGLE'])(
    'uses a landscape 16:9 master for %s',
    (platform) => {
      expect(resolvePlatformVideoFormat(platform)).toMatchObject({
        aspectRatio: '16:9',
        width: 1280,
        height: 720,
        ratio: '1280:720',
      })
    },
  )

  it('requires exact dimensions and duration before a video is attachable', () => {
    const target = resolvePlatformVideoFormat('INSTAGRAM')
    expect(validatePlatformVideoFormat({
      width: 720,
      height: 1280,
      durationSeconds: 8,
      contentType: 'video/mp4',
    }, target).passed).toBe(true)
    expect(validatePlatformVideoFormat({
      width: 1280,
      height: 720,
      durationSeconds: 8,
    }, target).passed).toBe(false)
    expect(validatePlatformVideoFormat({
      width: 720,
      height: 1280,
      durationSeconds: 4,
    }, target).passed).toBe(false)
  })
})
