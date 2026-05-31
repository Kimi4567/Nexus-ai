import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import fs from 'fs'
import path from 'path'
import cloudinary from 'cloudinary'

const cloudinaryV2 = cloudinary.v2

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = params

  try {
    // Fetch media with workspace to verify ownership
    const media = await prisma.media.findUnique({
      where: { id },
      include: { workspace: true },
    })

    if (!media) return NextResponse.json({ error: 'Not found', errorCode: 'NOT_FOUND' }, { status: 404 })
    if (!media.workspace || media.workspace.ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden', errorCode: 'FORBIDDEN' }, { status: 403 })
    }

    // Delete from DB first
    await prisma.media.delete({ where: { id } })

    // Delete local file if served via local storage route
    let fileDeleted = false
    if (media.url.startsWith('/api/storage/uploads/')) {
      const fileName = path.basename(media.url)
      const localPath = path.resolve(process.cwd(), '.storage', 'uploads', fileName)
      const tmpPath = path.join('/tmp/nexus_uploads', fileName)
      for (const filePath of [localPath, tmpPath]) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            fileDeleted = true
          }
        } catch {
          // Ignore individual file deletion failures — DB record is already gone
        }
      }
    }

    // Delete from Cloudinary if public_id is recorded and credentials are configured
    let cloudinaryDeleted = false
    let cloudinaryNote: string | undefined
    const hasCloudinaryCreds =
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      process.env.CLOUDINARY_CLOUD_NAME

    if (media.cloudinaryId && hasCloudinaryCreds) {
      try {
        cloudinaryV2.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        })
        const resourceType = media.type === 'VIDEO' ? 'video' : 'image'
        await cloudinaryV2.uploader.destroy(media.cloudinaryId, { resource_type: resourceType })
        cloudinaryDeleted = true
      } catch (err) {
        console.warn('Cloudinary delete failed — DB record removed but asset may remain on Cloudinary', err)
        cloudinaryNote = 'Removed from database. Cloudinary cleanup failed — asset may still exist remotely.'
      }
    }

    return NextResponse.json({
      deleted: true,
      fileDeleted,
      cloudinaryDeleted,
      ...(cloudinaryNote ? { cloudinaryNote } : {}),
    })
  } catch (err) {
    console.error('Delete media error', err)
    return NextResponse.json({ error: 'Delete failed', errorCode: 'DELETE_FAILED' }, { status: 500 })
  }
}
