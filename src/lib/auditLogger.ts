import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type AuditSeverity = 'INFO' | 'WARN' | 'ERROR'

export async function logUploadEvent(payload: {
  userId?: string
  workspaceId?: string
  projectId?: string
  sessionId?: string
  eventType: string
  severity?: AuditSeverity
  ip?: string
  metadata?: Prisma.InputJsonValue
}) {
  try {
    await prisma.uploadAudit.create({
      data: {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        projectId: payload.projectId,
        sessionId: payload.sessionId,
        eventType: payload.eventType,
        severity: payload.severity || 'INFO',
        ip: payload.ip,
        metadata: payload.metadata ?? undefined,
      },
    })
  } catch (err) {
    console.warn('Unable to write upload audit event', err)
  }
}

export async function logSuspiciousUpload(payload: {
  userId?: string
  workspaceId?: string
  projectId?: string
  sessionId?: string
  ip?: string
  reason: string
  metadata?: Record<string, unknown>
}) {
  return logUploadEvent({
    ...payload,
    eventType: 'SUSPICIOUS_UPLOAD',
    severity: 'WARN',
    metadata: { reason: payload.reason, ...(payload.metadata || {}) },
  })
}
