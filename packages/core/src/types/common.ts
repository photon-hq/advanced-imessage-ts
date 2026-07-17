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
 * Invoked once for every server heartbeat frame received on any
 * `subscribeEvents` / `watch` stream.
 *
 * The server emits heartbeats on a fixed cadence (~30s) even when no domain
 * events occur. Consumers can use this signal to run a stall watchdog: if no
 * heartbeat arrives within a grace window, the connection is likely half-open
 * and the stream should be torn down and re-established. Without this hook the
 * heartbeat frames are silently dropped and a half-open stall is undetectable
 * from the event stream alone.
 */
export type HeartbeatHandler = () => void;
