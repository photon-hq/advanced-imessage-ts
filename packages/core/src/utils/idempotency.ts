/**
 * Idempotency key generation utility.
 *
 * Generates a unique key for each mutating RPC call to ensure
 * at-most-once delivery semantics.
 */

/**
 * Generate a new idempotency key using a v4 UUID.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
