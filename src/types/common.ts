/**
 * Shared types used across multiple resource namespaces.
 */

/** Options for automatic retry with exponential back-off. */
export interface RetryOptions {
  /** Initial delay in milliseconds before the first retry. */
  readonly initialDelay?: number;
  /** Maximum number of attempts (including the initial call). */
  readonly maxAttempts?: number;
  /** Maximum delay in milliseconds between retries. */
  readonly maxDelay?: number;
}

/** Caller-provided key that lets the server deduplicate retries. */
export interface IdempotencyOptions {
  /** Stable key for one logical write. Reuse it only when retrying that same write. */
  readonly clientMessageId?: string;
}
