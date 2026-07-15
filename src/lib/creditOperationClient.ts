export function newClientCreditOperationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}

export function withCreditOperationHeader(operationId: string): Record<string, string> {
  return { 'Idempotency-Key': operationId }
}

const OPERATION_STORAGE_PREFIX = 'nexus:credit-operation:'
const memoryOperations = new Map<string, string>()

/** Creates a storage-safe scope without retaining prompts or other user text. */
export function creditOperationScope(namespace: string, identity: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193) >>> 0
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0
  }
  return `${namespace}:${identity.length.toString(36)}:${first.toString(36)}${second.toString(36)}`
}

function storedOperationId(scope: string): string | null {
  const memoryId = memoryOperations.get(scope)
  if (memoryId) return memoryId
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(`${OPERATION_STORAGE_PREFIX}${scope}`)
  } catch {
    return null
  }
}

function rememberOperationId(scope: string, operationId: string): void {
  memoryOperations.set(scope, operationId)
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(`${OPERATION_STORAGE_PREFIX}${scope}`, operationId)
  } catch {
    // Private browsing and hardened browsers can reject session storage. The
    // in-memory fallback still protects automatic retries in the current tab.
  }
}

function forgetOperationId(scope: string, operationId: string): void {
  if (memoryOperations.get(scope) === operationId) memoryOperations.delete(scope)
  if (typeof window === 'undefined') return
  try {
    const key = `${OPERATION_STORAGE_PREFIX}${scope}`
    if (window.sessionStorage.getItem(key) === operationId) window.sessionStorage.removeItem(key)
  } catch {
    // Nothing else is required; the server still enforces transaction-level
    // uniqueness if client storage is unavailable.
  }
}

/**
 * Sends one billable request with a durable per-action operation id.
 *
 * Any HTTP response proves the server received the request, so the client can
 * close the local operation. A network exception is ambiguous; the id remains
 * in session storage and is reused when the user retries the same action.
 */
export async function fetchCreditOperation(
  scope: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const operationId = storedOperationId(scope) ?? newClientCreditOperationId()
  rememberOperationId(scope, operationId)

  const headers = new Headers(init.headers)
  headers.set('Idempotency-Key', operationId)

  try {
    const response = await fetch(input, { ...init, headers })
    forgetOperationId(scope, operationId)
    return response
  } catch (error) {
    // Keep the id for a user retry after a timeout/offline failure. The server
    // may already have reserved or settled this exact operation.
    throw error
  }
}
