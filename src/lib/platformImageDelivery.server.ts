import sharp from 'sharp'
import {
  validatePlatformImageDimensions,
  type PlatformImageFormat,
  type PlatformImageFormatValidation,
} from '@/lib/platformImageFormat'

const MAX_DELIVERY_BYTES = 20 * 1024 * 1024

export async function verifyPlatformReadyImage(
  imageUrl: string,
  target: PlatformImageFormat,
): Promise<PlatformImageFormatValidation> {
  const response = await fetch(imageUrl, {
    headers: { Accept: 'image/*' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error('NEXUS could not verify the platform-ready image')

  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > MAX_DELIVERY_BYTES) {
    throw new Error('NEXUS platform-ready image exceeded the delivery limit')
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DELIVERY_BYTES) {
    throw new Error('NEXUS received an invalid platform-ready image')
  }

  const metadata = await sharp(bytes).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error('NEXUS could not read the platform-ready image dimensions')
  }

  return validatePlatformImageDimensions({
    width: metadata.width,
    height: metadata.height,
    contentType: response.headers.get('content-type'),
  }, target)
}
