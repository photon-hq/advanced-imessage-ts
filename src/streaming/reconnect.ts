/**
 * Auto-reconnecting wrapper for async iterable streams.
 *
 * Wraps a stream factory so that when the inner stream ends or errors,
 * the factory is re-invoked after an exponential back-off delay. Useful
 * for gRPC server-streaming RPCs that may be interrupted by transient
 * network issues.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ReconnectOptions {
  /** Initial delay in milliseconds before the first retry. Default `1000`. */
  readonly initialDelay?: number;
  /** Maximum number of consecutive reconnect attempts. Default `Infinity`. */
  readonly maxAttempts?: number;
  /** Maximum delay in milliseconds between retries. Default `30000`. */
  readonly maxDelay?: number;
  /** Multiplier applied to the delay after each failed attempt. Default `2`. */
  readonly multiplier?: number;
  /** Callback invoked before each reconnect attempt. */
  readonly onReconnect?: (attempt: number) => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Returns an `AsyncIterable` that transparently reconnects when the inner
 * stream produced by `createStream` ends or throws.
 *
 * Events yielded before a disconnect are delivered normally. After a
 * disconnect the generator waits (with exponential back-off) then calls
 * `createStream()` again and continues yielding.
 *
 * The generator terminates when:
 * - `maxAttempts` consecutive failures have been reached, or
 * - the consumer breaks / returns from the `for await` loop.
 *
 * @example
 * ```ts
 * const events = withReconnect(() => grpcClient.subscribe({}), {
 *   maxAttempts: 10,
 *   onReconnect: (n) => console.log(`Reconnecting (attempt ${n})...`),
 * });
 *
 * for await (const event of events) {
 *   handleEvent(event);
 * }
 * ```
 */
export function withReconnect<T>(
  createStream: () => AsyncIterable<T>,
  options?: ReconnectOptions
): AsyncIterable<T> {
  const initialDelay = options?.initialDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30_000;
  const multiplier = options?.multiplier ?? 2;
  const maxAttempts = options?.maxAttempts ?? Number.POSITIVE_INFINITY;
  const onReconnect = options?.onReconnect;

  async function* reconnecting(): AsyncGenerator<T> {
    let consecutiveFailures = 0;
    let delay = initialDelay;

    for (;;) {
      try {
        const stream = createStream();

        // Reset backoff state once we successfully start receiving events.
        let receivedAtLeastOne = false;

        for await (const event of stream) {
          if (!receivedAtLeastOne) {
            receivedAtLeastOne = true;
            consecutiveFailures = 0;
            delay = initialDelay;
          }
          yield event;
        }

        // The inner stream ended gracefully. Treat this like a disconnect
        // so we attempt to reconnect (servers may close streams periodically).
      } catch {
        // Stream errored -- fall through to the reconnect logic below.
      }

      consecutiveFailures++;

      if (consecutiveFailures > maxAttempts) {
        // Exhausted all attempts -- let the generator end.
        return;
      }

      onReconnect?.(consecutiveFailures);

      // Wait with exponential backoff before retrying.
      await sleep(delay);
      delay = Math.min(delay * multiplier, maxDelay);
    }
  }

  return reconnecting();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
