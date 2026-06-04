// Placeholder upload processing helpers
// This module defines the upload architecture for async processing, transcoding,
// thumbnail generation, compression, and future render pipelines.
// Phase 2: wire enqueueJob once BullMQ / Redis is in place.

import { prisma } from './prisma'

export async function scheduleProcessingForMedia(mediaId: string) {
  try {
    await prisma.media.update({ where: { id: mediaId }, data: {} })
  } catch {
    // noop — media record may not exist yet
  }
  // TODO: enqueue to BullMQ when Redis is available
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
