/**
 * Retry utility for transient gRPC errors.
 *
 * Uses exponential backoff with jitter, only retrying when the caught error
 * is an {@link IMessageError} with `retryable: true`.
 */

import { IMessageError } from "../errors/imessage-error.ts";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Configuration for the retry behaviour. */
export interface RetryOptions {
  /** Base delay in milliseconds before the first retry. */
  readonly baseDelayMs: number;
  /** Maximum delay in milliseconds between retries. */
  readonly maxDelayMs: number;
  /** Maximum number of retry attempts (not including the initial call). */
  readonly maxRetries: number;
  /** Abort signal to cancel pending retries. */
  readonly signal?: AbortSignal;
}

/** Sensible defaults for retry options. */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Execute `fn` with automatic retry on retryable errors.
 *
 * The function is invoked immediately. If it throws an {@link IMessageError}
 * whose `retryable` flag is `true`, the call is retried up to
 * `options.maxRetries` times with exponential backoff and full jitter.
 *
 * Non-retryable errors are re-thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Only retry IMessageError instances that are explicitly retryable.
      const isRetryable = error instanceof IMessageError && error.retryable;

      if (!isRetryable || attempt >= options.maxRetries) {
        throw error;
      }

      // Check if the caller has cancelled.
      if (options.signal?.aborted) {
        throw error;
      }

      // Exponential backoff with full jitter.
      const exponentialDelay = options.baseDelayMs * 2 ** attempt;
      const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
      const jitteredDelay = Math.random() * cappedDelay;

      await sleep(jitteredDelay, options.signal);
    }
  }

  // Should be unreachable, but satisfies the type checker.
  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for the given number of milliseconds, aborting early if the signal
 * fires.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
