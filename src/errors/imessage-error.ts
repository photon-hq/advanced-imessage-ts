/**
 * Error class hierarchy for the advanced-imessage-ts SDK.
 *
 * Inspired by Stripe's error design: a single base class with typed subclasses
 * so callers can use `instanceof` to handle specific failure modes rather than
 * inspecting boolean flags or string codes.
 *
 * A factory function in `error-handler.ts` maps gRPC errors to the correct
 * subclass automatically.
 */

import type { ErrorCode } from "../types/errors.ts";

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

export interface IMessageErrorOptions {
  /** The original error that caused this one. */
  readonly cause?: Error;
  /** Canonical error code from the server. */
  readonly code: ErrorCode;
  /** Arbitrary key-value pairs providing additional context. */
  readonly context?: Record<string, string>;
  /** Numeric gRPC status code (mirrors `nice-grpc-common` Status enum). */
  readonly grpcCode: number;
  /** Whether the caller should retry the request. */
  readonly retryable: boolean;
}

// ---------------------------------------------------------------------------
// Base error
// ---------------------------------------------------------------------------

/**
 * Base error for every failure surfaced by the SDK.
 *
 * All properties are `readonly` -- errors are informational, not mutable.
 */
export class IMessageError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly grpcCode: number;
  readonly context: Record<string, string>;

  constructor(message: string, options: IMessageErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "IMessageError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.grpcCode = options.grpcCode;
    this.context = options.context ?? {};
  }
}

// ---------------------------------------------------------------------------
// Subclasses
// ---------------------------------------------------------------------------

/**
 * The request could not be authenticated or the caller lacks permission.
 *
 * Maps from gRPC `UNAUTHENTICATED` and `PERMISSION_DENIED`.
 */
export class AuthenticationError extends IMessageError {
  constructor(message: string, options: IMessageErrorOptions) {
    super(message, options);
    this.name = "AuthenticationError";
  }
}

/**
 * The requested resource was not found.
 *
 * Maps from gRPC `NOT_FOUND`.
 */
export class NotFoundError extends IMessageError {
  constructor(message: string, options: IMessageErrorOptions) {
    super(message, options);
    this.name = "NotFoundError";
  }
}

/**
 * A rate limit or quota was exceeded.
 *
 * Maps from gRPC `RESOURCE_EXHAUSTED`.
 */
export class RateLimitError extends IMessageError {
  constructor(message: string, options: IMessageErrorOptions) {
    super(message, options);
    this.name = "RateLimitError";
  }
}

/**
 * The request contained invalid arguments or a failed precondition.
 *
 * Maps from gRPC `INVALID_ARGUMENT` and `FAILED_PRECONDITION`.
 */
export class ValidationError extends IMessageError {
  constructor(message: string, options: IMessageErrorOptions) {
    super(message, options);
    this.name = "ValidationError";
  }
}

/**
 * The server is unreachable or the request timed out.
 *
 * Maps from gRPC `UNAVAILABLE` and `DEADLINE_EXCEEDED`.
 */
export class ConnectionError extends IMessageError {
  constructor(message: string, options: IMessageErrorOptions) {
    super(message, options);
    this.name = "ConnectionError";
  }
}
