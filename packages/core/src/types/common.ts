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

/**
 * Invoked synchronously for each server heartbeat frame consumed by a gRPC
 * `subscribeEvents` / `watch` stream. Keep the callback synchronous and do not
 * throw: a thrown error fails the stream, and returned promises are not awaited.
 *
 * Heartbeats are pull-driven: slow event processing can delay them. They do not
 * acknowledge delivery or prove processing has completed. Use a per-subscription
 * callback to avoid treating a healthy sibling stream as evidence for this one.
 */
export type HeartbeatHandler = () => void;
