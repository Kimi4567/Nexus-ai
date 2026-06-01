/**
 * Nexus AI — AES-256-GCM token encryption for social access tokens.
 *
 * Social connections (Meta, LinkedIn, TikTok) store OAuth access tokens in the
 * database. If the DB is ever compromised, plain tokens would let an attacker
 * post to users' social accounts. Encrypting them at rest limits blast radius.
 *
 * Algorithm: AES-256-GCM (authenticated encryption)
 *   - 32-byte key from TOKEN_ENCRYPTION_KEY env var (hex-encoded 64 chars)
 *   - Random 12-byte IV per encryption — stored as prefix: "iv:ciphertext"
 *   - GCM auth tag appended to ciphertext automatically by Node.js crypto
 *
 * SETUP:
 *   1. Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   2. Add to .env: TOKEN_ENCRYPTION_KEY=<64-char-hex>
 *   3. Add to Vercel environment variables
 *
 * MIGRATION: Existing plain tokens will fail decryption gracefully — they're
 * detected by the absence of the "iv:" prefix and returned as-is (plain).
 * This allows a gradual migration: new connections get encrypted, old ones
 * keep working until they reconnect.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // 96-bit IV recommended for GCM
const TAG_LENGTH = 16 // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be set as a 64-char hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a token string.
 * Returns "nexus_enc:<base64(iv + ciphertext + authtag)>"
 */
export function encryptToken(plaintext: string): string {
  try {
    const key = getKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()

    // Pack: iv | ciphertext | authTag
    const packed = Buffer.concat([iv, encrypted, authTag])
    return `nexus_enc:${packed.toString('base64')}`
  } catch (err) {
    console.error('[tokenCrypto] Encryption failed:', (err as Error).message)
    throw new Error('Token encryption failed')
  }
}

/**
 * Decrypt a token string.
 * - If the value starts with "nexus_enc:", decrypts it.
 * - Otherwise returns the value unchanged (plain legacy token — gradual migration).
 * - Returns null if decryption fails (corrupted or wrong key).
 */
export function decryptToken(value: string | null | undefined): string | null {
  if (!value) return null

  // Legacy plain token — not yet encrypted
  if (!value.startsWith('nexus_enc:')) {
    return value
  }

  try {
    const key = getKey()
    const packed = Buffer.from(value.slice('nexus_enc:'.length), 'base64')

    const iv = packed.subarray(0, IV_LENGTH)
    const authTag = packed.subarray(packed.length - TAG_LENGTH)
    const ciphertext = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
  } catch (err) {
    console.error('[tokenCrypto] Decryption failed (wrong key or corrupted):', (err as Error).message)
    return null
  }
}

/**
 * Returns true if the value is already encrypted by this system.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('nexus_enc:')
}
