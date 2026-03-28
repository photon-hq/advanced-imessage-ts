/**
 * nice-grpc client middleware for authentication and idempotency.
 *
 * Each middleware is an async generator that wraps the call chain, injecting
 * metadata headers before forwarding to the next handler.
 */

import { Metadata, type CallOptions, type ClientMiddleware } from "nice-grpc-common";
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
  token: string | (() => Promise<string>),
): ClientMiddleware {
  return async function* authMw(call, options) {
    const resolvedToken =
      typeof token === "function" ? await token() : token;

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
