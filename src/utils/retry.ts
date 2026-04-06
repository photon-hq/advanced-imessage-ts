/**
 * Retry utility for transient gRPC errors.
 *
 * Uses exponential backoff with jitter, only retrying when the caught error
 * is an {@link IMessageError} with `retryable: true`.
 */

import { IMessageError } from "../errors/imessage-error.ts";

export type { RetryOptions } from "../types/common.ts";

import type { RetryOptions } from "../types/common.ts";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Sensible defaults for retry options. */
export const DEFAULT_RETRY_OPTIONS: Required<
  Pick<RetryOptions, "initialDelay" | "maxAttempts" | "maxDelay">
> = {
  maxAttempts: 4,
  initialDelay: 200,
  maxDelay: 5000,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Execute `fn` with automatic retry on retryable errors.
 *
 * The function is invoked immediately. If it throws an {@link IMessageError}
 * whose `retryable` flag is `true`, the call is retried up to
 * `maxAttempts - 1` times with exponential backoff and full jitter.
 *
 * Non-retryable errors are re-thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { readonly signal?: AbortSignal } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts;
  const initialDelay =
    options.initialDelay ?? DEFAULT_RETRY_OPTIONS.initialDelay;
  const maxDelay = options.maxDelay ?? DEFAULT_RETRY_OPTIONS.maxDelay;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Only retry IMessageError instances that are explicitly retryable.
      const isRetryable = error instanceof IMessageError && error.retryable;

      if (!isRetryable || attempt >= maxAttempts - 1) {
        throw error;
      }

      // Check if the caller has cancelled.
      if (options.signal?.aborted) {
        throw error;
      }

      // Exponential backoff with full jitter.
      const exponentialDelay = initialDelay * 2 ** attempt;
      const cappedDelay = Math.min(exponentialDelay, maxDelay);
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
