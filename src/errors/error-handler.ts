/**
 * Factory that converts a Connect error into the appropriate
 * {@link IMessageError} subclass.
 *
 * The mapping relies on three pieces of information carried in gRPC trailing
 * metadata, which Connect exposes as `ConnectError.metadata` (a `Headers`):
 *
 * - `error-code` -- the canonical {@link ErrorCode} string set by the server.
 * - `x-retryable` -- `"true"` if the caller should retry, absent otherwise.
 * - `error-context-*` -- structured context values surfaced on
 *   {@link IMessageError.context}.
 *
 * The Connect status code determines which subclass is instantiated:
 *
 * | Connect Code                           | SDK error class          |
 * | -------------------------------------- | ------------------------ |
 * | Unauthenticated, PermissionDenied      | AuthenticationError      |
 * | NotFound                               | NotFoundError            |
 * | ResourceExhausted                      | RateLimitError           |
 * | InvalidArgument, FailedPrecondition    | ValidationError          |
 * | Unavailable, DeadlineExceeded          | ConnectionError          |
 * | Everything else                        | IMessageError (base)     |
 */

import { Code, ConnectError } from "@connectrpc/connect";
import type { ErrorCode } from "../types/errors.ts";
import {
  readMetadataPrefixedEntries,
  readMetadataValue,
} from "../utils/grpc-metadata.ts";
import {
  AuthenticationError,
  ConnectionError,
  IMessageError,
  type IMessageErrorOptions,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "./imessage-error.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a caught Connect error into the appropriate `IMessageError`
 * subclass.
 *
 * Errors that are already `IMessageError`s are returned unchanged. Anything
 * else is normalised through `ConnectError.from`, so non-Connect failures
 * (e.g. network errors) map to the base `IMessageError` with an
 * `internalError` code.
 */
export function fromGrpcError(error: unknown): IMessageError {
  if (error instanceof IMessageError) {
    return error;
  }

  const connectError = ConnectError.from(error);
  const { metadata } = connectError;
  const grpcCode = connectError.code;
  const details = connectError.rawMessage;

  const errorCode =
    (readMetadataValue(metadata, "error-code") as ErrorCode | undefined) ??
    ("internalError" as ErrorCode);
  const retryable = readMetadataValue(metadata, "x-retryable") === "true";
  const context = readMetadataPrefixedEntries(metadata, "error-context-");

  const options: IMessageErrorOptions = {
    code: errorCode,
    context,
    retryable,
    grpcCode,
    cause: connectError,
  };

  switch (grpcCode) {
    case Code.Unauthenticated:
    case Code.PermissionDenied:
      return new AuthenticationError(details, options);

    case Code.NotFound:
      return new NotFoundError(details, options);

    case Code.ResourceExhausted:
      return new RateLimitError(details, options);

    case Code.InvalidArgument:
    case Code.FailedPrecondition:
      return new ValidationError(details, options);

    case Code.Unavailable:
    case Code.DeadlineExceeded:
      return new ConnectionError(details, options);

    default:
      return new IMessageError(details, options);
  }
}
