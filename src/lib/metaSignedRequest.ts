import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export type MetaSignedRequestPayload = {
  userId: string
  algorithm: string
  issuedAt: number
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64')
}

export async function readMetaSignedRequest(req: NextRequest): Promise<string | null> {
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(await req.text()).get('signed_request')
  }

  if (contentType.includes('application/json')) {
    const body = await req.json()
    return typeof body?.signed_request === 'string' ? body.signed_request : null
  }

  const formData = await req.formData().catch(() => null)
  const value = formData?.get('signed_request')
  return typeof value === 'string' ? value : null
}

export function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): MetaSignedRequestPayload | null {
  try {
    const parts = signedRequest.split('.')
    if (parts.length !== 2) return null

    const [encodedSignature, encodedPayload] = parts
    const signature = base64UrlDecode(encodedSignature)
    const expectedSignature = createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest()

    if (
      signature.length !== expectedSignature.length
      || !timingSafeEqual(signature, expectedSignature)
    ) {
      return null
    }

    const data = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'))
    return {
      userId: String(data.user_id || ''),
      algorithm: String(data.algorithm || ''),
      issuedAt: Number(data.issued_at || 0),
    }
  } catch {
    return null
  }
}

export function isValidFreshMetaSignedRequest(
  payload: MetaSignedRequestPayload,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const ageSeconds = nowSeconds - payload.issuedAt
  return Boolean(payload.userId)
    && payload.algorithm.toUpperCase() === 'HMAC-SHA256'
    && Number.isFinite(payload.issuedAt)
    && ageSeconds >= -60
    && ageSeconds <= 3600
}
