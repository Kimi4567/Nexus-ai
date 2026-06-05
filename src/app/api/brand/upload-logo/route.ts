/**
 * POST /api/brand/upload-logo
 *
 * Accepts a multipart form with a single "file" field.
 * Uploads to Cloudinary under nexus/brand-logos/
 * Returns { logoUrl } on success.
 *
 * The caller is responsible for saving logoUrl to BrandProfile
 * via POST /api/brand.
 */

import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { getAuthUser } from '@/lib/apiAuth'

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate type (images only)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    // Max 5 MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
    }

    // Convert File → Buffer → base64 data URI
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const b64 = buffer.toString('base64')
    const dataUri = `data:${file.type};base64,${b64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `nexus/brand-logos/${user.id}`,
      public_id: 'logo',
      overwrite: true,           // always replace with latest logo
      resource_type: 'image',
      transformation: [
        { width: 400, height: 400, crop: 'limit' },   // cap at 400×400
        { quality: 'auto:good' },
      ],
    })

    return NextResponse.json({ logoUrl: result.secure_url })
  } catch (err: unknown) {
    console.error('[brand/upload-logo]', err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
