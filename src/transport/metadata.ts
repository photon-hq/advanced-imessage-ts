/**
 * nice-grpc client middleware for authentication and idempotency.
 *
 * Each middleware is an async generator that wraps the call chain, injecting
 * metadata headers before forwarding to the next handler.
 */

import {
  type CallOptions,
  type ClientMiddleware,
  Metadata,
} from "nice-grpc-common";
import type { RetryOptions } from "../types/common.ts";
import { generateIdempotencyKey } from "../utils/idempotency.ts";

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/**
 * Creates a nice-grpc client middleware that injects an `authorization`
 * metadata header with a Bearer token on every call.
 *
 * The `token` parameter can be a static string or an async function that
 * resolves a fresh token on each call (useful for rotating credentials).
 */
export function authMiddleware(
  token: string | (() => Promise<string>)
): ClientMiddleware {
  return async function* authMw(call, options) {
    const resolvedToken = typeof token === "function" ? await token() : token;

    const metadata = Metadata(options.metadata);
    metadata.set("authorization", `Bearer ${resolvedToken}`);

    const nextOptions: CallOptions = {
      ...options,
      metadata,
    };

    return yield* call.next(call.request, nextOptions);
  };
}

// ---------------------------------------------------------------------------
// Idempotency middleware
// ---------------------------------------------------------------------------

/**
 * Method paths that are considered safe (read-only) and should not have an
 * idempotency key injected. We match on the method-level idempotency option
 * when available, and fall back to heuristic name matching for methods
 * whose proto definition does not set the option.
 */
const READ_PREFIXES = ["get", "list", "check", "subscribe", "can"] as const;

function isMutatingMethod(path: string): boolean {
  // path looks like "/photon.imessage.v1.MessageService/Send"
  const methodName = path.split("/").pop()?.toLowerCase() ?? "";
  return !READ_PREFIXES.some((prefix) => methodName.startsWith(prefix));
}

/**
 * Creates a nice-grpc client middleware that sets an `x-idempotency-key`
 * metadata header on mutating (non-read) RPC calls.
 *
 * The key is a v4 UUID generated per call via `crypto.randomUUID()`.
 * Read-only methods (Get*, List*, Check*, Subscribe*, Can*) are skipped.
 */
export function idempotencyMiddleware(): ClientMiddleware {
  return async function* idempotencyMw(call, options) {
    // Only inject for mutating calls.
    if (
      call.method.options.idempotencyLevel === "NO_SIDE_EFFECTS" ||
      call.method.options.idempotencyLevel === "IDEMPOTENT" ||
      !isMutatingMethod(call.method.path)
    ) {
      return yield* call.next(call.request, options);
    }

    const metadata = Metadata(options.metadata);
    metadata.set("x-idempotency-key", generateIdempotencyKey());

    const nextOptions: CallOptions = {
      ...options,
      metadata,
    };

    return yield* call.next(call.request, nextOptions);
  };
}

// ---------------------------------------------------------------------------
// Retry middleware
// ---------------------------------------------------------------------------

/** Default retry settings (4 total attempts with exponential backoff). */
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_INITIAL_DELAY = 200;
const DEFAULT_MAX_DELAY = 5000;

/**
 * Read a string value from gRPC trailing metadata attached to an error.
 */
function readMetadataValue(error: unknown, key: string): string | undefined {
  const meta = (error as { metadata?: { get(key: string): unknown[] } })
    .metadata;
  if (!meta || typeof meta.get !== "function") {
    return undefined;
  }
  const values = meta.get(key);
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  const first = values[0];
  return typeof first === "string" ? first : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a nice-grpc client middleware that automatically retries failed
 * unary calls when the server indicates the error is retryable (via the
 * `x-retryable` trailing metadata header).
 *
 * Uses exponential backoff with full jitter.  Streaming calls are passed
 * through without retry.
 */
export function retryMiddleware(opts: RetryOptions = {}): ClientMiddleware {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialDelay = opts.initialDelay ?? DEFAULT_INITIAL_DELAY;
  const maxDelay = opts.maxDelay ?? DEFAULT_MAX_DELAY;

  return async function* retryMw(call, options) {
    // Skip streaming calls — retrying mid-stream would duplicate data.
    if (call.method.responseStream || call.method.requestStream) {
      return yield* call.next(call.request, options);
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return yield* call.next(call.request, options);
      } catch (error: unknown) {
        lastError = error;

        const retryable = readMetadataValue(error, "x-retryable") === "true";

        if (!retryable || attempt >= maxAttempts - 1) {
          throw error;
        }

        // Exponential backoff with full jitter.
        const exponentialDelay = initialDelay * 2 ** attempt;
        const cappedDelay = Math.min(exponentialDelay, maxDelay);
        await sleep(Math.random() * cappedDelay);
      }
    }

    throw lastError;
  };
}

// ---------------------------------------------------------------------------
// Timeout middleware
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Trailing metadata capture middleware
// ---------------------------------------------------------------------------

/**
 * nice-grpc wraps `@grpc/grpc-js` errors into `ClientError`, **dropping
 * trailing metadata** in the process (see `wrapClientError.ts`).  This
 * middleware intercepts the `onTrailer` callback to capture trailing metadata
 * and re-attaches it to errors in a format compatible with `readMetadataValue`.
 *
 * It should always be the **innermost** middleware so that outer middleware
 * (retry, error handlers) can read server-sent headers like `error-code`
 * and `x-retryable`.
 */
export function trailingMetadataCaptureMiddleware(): ClientMiddleware {
  return async function* trailingMetadataCaptureMw(call, options) {
    let trailer: ReturnType<typeof Metadata> | undefined;

    try {
      return yield* call.next(call.request, {
        ...options,
        onTrailer(t) {
          trailer = t;
          options.onTrailer?.(t);
        },
      });
    } catch (error) {
      // Yield one microtask so that the onTrailer handler has a chance
      // to fire in case @grpc/grpc-js delivers it via nextTick.
      await Promise.resolve();

      if (trailer && error instanceof Error) {
        // Attach an adapter matching the shape readMetadataValue expects:
        // { get(key): unknown[] }
        const captured = trailer;
        Object.defineProperty(error, "metadata", {
          value: {
            get(key: string): unknown[] {
              const val = captured.get(key);
              return val === undefined ? [] : [val];
            },
          },
          writable: true,
          configurable: true,
        });
      }
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Timeout middleware
// ---------------------------------------------------------------------------

/**
 * Creates a nice-grpc client middleware that sets a default timeout on
 * every call via `AbortSignal.timeout()`.
 *
 * If the caller already supplied an `AbortSignal`, the timeout signal is
 * combined with it using `AbortSignal.any()` so that either can cancel.
 */
export function timeoutMiddleware(timeoutMs: number): ClientMiddleware {
  return async function* timeoutMw(call, options) {
    if (options.signal) {
      // Preserve the caller's signal while adding the timeout.
      const combined = AbortSignal.any([
        options.signal,
        AbortSignal.timeout(timeoutMs),
      ]);
      return yield* call.next(call.request, {
        ...options,
        signal: combined,
      });
    }

    return yield* call.next(call.request, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  };
}
