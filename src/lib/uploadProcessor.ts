// Placeholder upload processing helpers
// This module defines the upload architecture for async processing, transcoding,
// thumbnail generation, compression, and future render pipelines.

import { prisma } from './prisma'
import { enqueueJob } from './queue'

export async function scheduleProcessingForMedia(mediaId: string) {
  try {
    await prisma.media.update({ where: { id: mediaId }, data: { /* queuedForProcessing: true */ } as any })
  } catch (err) {
    console.warn('Failed to mark media for processing', err)
  }

  enqueueJob({
    id: `media-${mediaId}-${Date.now()}`,
    type: 'media.process',
    payload: { mediaId },
    createdAt: Date.now(),
  })
}

export async function markMediaProcessingFailed(mediaId: string, reason: string) {
  try {
    await prisma.media.update({ where: { id: mediaId }, data: { /* processingError: reason */ } as any })
  } catch (err) {
    console.warn('Failed to mark media processing failed', err)
  }
}

export async function extractVideoMetadataPlaceholder(buffer: Buffer) {
  // Placeholder for actual FFprobe or cloud metadata extraction step.
  // A background worker should fill duration, width, height, and poster frame URL.
  return { duration: null as number | null, width: null as number | null, height: null as number | null }
}
