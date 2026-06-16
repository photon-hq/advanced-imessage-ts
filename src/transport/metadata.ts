/**
 * Connect client interceptors for authentication, idempotency, timeouts, and
 * retries.
 *
 * Each interceptor wraps the call chain `(next) => async (req) => …`, mutating
 * or replacing the request before forwarding it to the next handler. The same
 * interceptor type covers unary and streaming calls; interceptors that only
 * apply to unary RPCs short-circuit on `req.stream`.
 */

import {
  ConnectError,
  type Interceptor,
  type StreamResponse,
  type UnaryRequest,
  type UnaryResponse,
} from "@connectrpc/connect";
import type { RetryOptions } from "../types/common.ts";
import { generateIdempotencyKey } from "../utils/idempotency.ts";
import { DEFAULT_RETRY_OPTIONS } from "../utils/retry.ts";
import { sleep } from "../utils/sleep.ts";

// ---------------------------------------------------------------------------
// Auth interceptor
// ---------------------------------------------------------------------------

/**
 * Creates an interceptor that injects an `authorization` header with a Bearer
 * token on every call.
 *
 * The `token` parameter can be a static string or an async function that
 * resolves a fresh token on each call (useful for rotating credentials).
 */
export function authInterceptor(
  token: string | (() => Promise<string>)
): Interceptor {
  return (next) => async (req) => {
    const resolvedToken = typeof token === "function" ? await token() : token;
    req.header.set("authorization", `Bearer ${resolvedToken}`);
    return await next(req);
  };
}

// ---------------------------------------------------------------------------
// Idempotency interceptor
// ---------------------------------------------------------------------------

const MUTATING_METHODS: ReadonlySet<string> = new Set([
  "/photon.imessage.v1.AttachmentService/UploadAttachment",
  "/photon.imessage.v1.ChatService/CreateChat",
  "/photon.imessage.v1.ChatService/MarkChatRead",
  "/photon.imessage.v1.ChatService/RemoveBackground",
  "/photon.imessage.v1.ChatService/SetBackground",
  "/photon.imessage.v1.ChatService/SetTyping",
  "/photon.imessage.v1.ChatService/ShareContactInfo",
  "/photon.imessage.v1.GroupService/AddParticipants",
  "/photon.imessage.v1.GroupService/LeaveGroup",
  "/photon.imessage.v1.GroupService/RemoveIcon",
  "/photon.imessage.v1.GroupService/RemoveParticipants",
  "/photon.imessage.v1.GroupService/SetDisplayName",
  "/photon.imessage.v1.GroupService/SetIcon",
  "/photon.imessage.v1.LocationService/RequestFriendLocationSharing",
  "/photon.imessage.v1.MessageService/EditMessage",
  "/photon.imessage.v1.MessageService/NotifySilencedMessage",
  "/photon.imessage.v1.MessageService/PlaceSticker",
  "/photon.imessage.v1.MessageService/SendAttachmentMessage",
  "/photon.imessage.v1.MessageService/SendCustomizedMiniAppMessage",
  "/photon.imessage.v1.MessageService/SendMultipartMessage",
  "/photon.imessage.v1.MessageService/SendTextMessage",
  "/photon.imessage.v1.MessageService/SetReaction",
  "/photon.imessage.v1.PollService/AddPollOption",
  "/photon.imessage.v1.PollService/CreatePoll",
  "/photon.imessage.v1.PollService/UnvotePoll",
  "/photon.imessage.v1.PollService/VotePoll",
] as const);

/** Fully-qualified `/package.Service/Method` path for a Connect request. */
function methodPath(serviceTypeName: string, methodName: string): string {
  return `/${serviceTypeName}/${methodName}`;
}

/**
 * Creates an interceptor that sets an `x-idempotency-key` header on mutating
 * (non-read) RPC calls. The key is a v4 UUID generated per call via
 * `crypto.randomUUID()`. Read-only methods are skipped.
 */
export function idempotencyInterceptor(): Interceptor {
  return (next) => async (req) => {
    const path = methodPath(req.service.typeName, req.method.name);
    if (MUTATING_METHODS.has(path)) {
      req.header.set("x-idempotency-key", generateIdempotencyKey());
    }
    return await next(req);
  };
}

// ---------------------------------------------------------------------------
// Retry interceptor
// ---------------------------------------------------------------------------

interface RetryLimits {
  initialDelay: number;
  maxAttempts: number;
  maxDelay: number;
}

/** Whether the server flagged the error as retryable via trailing metadata. */
function isRetryable(error: unknown): boolean {
  return ConnectError.from(error).metadata.get("x-retryable") === "true";
}

/** Exponential backoff with full jitter, capped at `maxDelay`. */
function jitteredBackoff(attempt: number, limits: RetryLimits): number {
  const capped = Math.min(limits.initialDelay * 2 ** attempt, limits.maxDelay);
  return Math.random() * capped;
}

/** Run a unary call with retry/backoff for server-flagged retryable errors. */
async function retryUnaryCall(
  next: (req: UnaryRequest) => Promise<UnaryResponse | StreamResponse>,
  req: UnaryRequest,
  limits: RetryLimits
): Promise<UnaryResponse | StreamResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt < limits.maxAttempts; attempt++) {
    try {
      return await next(req);
    } catch (error: unknown) {
      lastError = error;

      const canRetry = isRetryable(error) && attempt < limits.maxAttempts - 1;
      if (!canRetry) {
        throw error;
      }

      await sleep(jitteredBackoff(attempt, limits), req.signal);

      // Stop retrying if the caller has cancelled.
      if (req.signal.aborted) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Creates an interceptor that automatically retries failed unary calls when
 * the server indicates the error is retryable (via the `x-retryable` trailing
 * metadata header, surfaced on `ConnectError.metadata`).
 *
 * Uses exponential backoff with full jitter. Streaming calls are passed
 * through without retry — retrying mid-stream would duplicate data.
 */
export function retryInterceptor(opts: RetryOptions = {}): Interceptor {
  const limits: RetryLimits = {
    maxAttempts: Math.max(
      1,
      opts.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts
    ),
    initialDelay: opts.initialDelay ?? DEFAULT_RETRY_OPTIONS.initialDelay,
    maxDelay: opts.maxDelay ?? DEFAULT_RETRY_OPTIONS.maxDelay,
  };

  return (next) => (req) => {
    // Skip streaming calls — retrying mid-stream would duplicate data.
    if (req.stream) {
      return next(req);
    }
    return retryUnaryCall(next, req, limits);
  };
}

// ---------------------------------------------------------------------------
// Timeout interceptor
// ---------------------------------------------------------------------------

/**
 * Creates an interceptor that applies a default deadline to unary calls by
 * combining the caller's `AbortSignal` with `AbortSignal.timeout()`. Streaming
 * calls are passed through untouched to avoid killing long-lived subscriptions.
 */
export function timeoutInterceptor(timeoutMs: number): Interceptor {
  return (next) => async (req) => {
    if (req.stream) {
      return await next(req);
    }

    const signal = AbortSignal.any([
      req.signal,
      AbortSignal.timeout(timeoutMs),
    ]);

    return await next({ ...req, signal });
  };
}
