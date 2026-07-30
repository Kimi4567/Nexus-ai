import cloudinary from 'cloudinary'

export interface CloudinaryAssetReference {
  publicId: string
  resourceType: 'image' | 'video' | 'raw'
}

export interface CloudinaryCleanupResult {
  attempted: number
  removed: number
  pending: number
}

const cloudinaryV2 = cloudinary.v2

function stripFileExtension(value: string): string {
  return value.replace(/\.[a-z0-9]{2,8}$/iu, '')
}

export function cloudinaryReferenceFromUrl(value: string | null | undefined): CloudinaryAssetReference | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null

    const parts = url.pathname.split('/').filter(Boolean)
    const uploadIndex = parts.indexOf('upload')
    if (uploadIndex < 2) return null

    const resourceType = parts[1]
    if (resourceType !== 'image' && resourceType !== 'video' && resourceType !== 'raw') return null

    const versionIndex = parts.findIndex((part, index) => index > uploadIndex && /^v\d+$/u.test(part))
    if (versionIndex < 0 || versionIndex >= parts.length - 1) return null

    const publicId = stripFileExtension(parts.slice(versionIndex + 1).join('/'))
    if (!publicId) return null

    return { publicId, resourceType }
  } catch {
    return null
  }
}

export async function cleanupCloudinaryAssets(
  references: Array<CloudinaryAssetReference | null | undefined>,
): Promise<CloudinaryCleanupResult> {
  const unique = new Map<string, CloudinaryAssetReference>()
  for (const reference of references) {
    if (!reference?.publicId) continue
    unique.set(`${reference.resourceType}:${reference.publicId}`, reference)
  }

  const assets = [...unique.values()]
  if (assets.length === 0) return { attempted: 0, removed: 0, pending: 0 }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME
    || !process.env.CLOUDINARY_API_KEY
    || !process.env.CLOUDINARY_API_SECRET
  ) {
    return { attempted: assets.length, removed: 0, pending: assets.length }
  }

  cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  const outcomes = await Promise.all(assets.map(async asset => {
    try {
      const result = await cloudinaryV2.uploader.destroy(asset.publicId, {
        resource_type: asset.resourceType,
        invalidate: true,
      })
      return result?.result === 'ok' || result?.result === 'not found'
    } catch (error) {
      console.error('[external-asset-cleanup] Cloudinary cleanup deferred', {
        resourceType: asset.resourceType,
        error,
      })
      return false
    }
  }))

  const removed = outcomes.filter(Boolean).length
  return {
    attempted: assets.length,
    removed,
    pending: assets.length - removed,
  }
}
