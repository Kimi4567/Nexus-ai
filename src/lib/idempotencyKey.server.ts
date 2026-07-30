const VALID_IDEMPOTENCY_KEY = /^[a-zA-Z0-9._:-]{8,200}$/

export function parseIdempotencyKey(request: Request): string | null {
  const key = request.headers.get('idempotency-key')?.trim() || ''
  return VALID_IDEMPOTENCY_KEY.test(key) ? key : null
}
