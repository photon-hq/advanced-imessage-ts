/**
 * Factory that converts a gRPC error into the appropriate {@link IMessageError}
 * subclass.
 *
 * The mapping relies on two pieces of information carried in gRPC trailing
 * metadata:
 *
 * - `error-code`  -- the canonical {@link ErrorCode} string set by the server.
 * - `x-retryable` -- `"true"` if the caller should retry, absent otherwise.
 *
 * The gRPC status code determines which subclass is instantiated:
 *
 * | gRPC status                            | SDK error class          |
 * | -------------------------------------- | ------------------------ |
 * | UNAUTHENTICATED, PERMISSION_DENIED     | AuthenticationError      |
 * | NOT_FOUND                              | NotFoundError            |
 * | RESOURCE_EXHAUSTED                     | RateLimitError           |
 * | INVALID_ARGUMENT, FAILED_PRECONDITION  | ValidationError          |
 * | UNAVAILABLE, DEADLINE_EXCEEDED         | ConnectionError          |
 * | Everything else                        | IMessageError (base)     |
 */

import { ClientError, Status } from "nice-grpc-common";
import type { ErrorCode } from "../types/errors.ts";
import { readMetadataValue } from "../utils/grpc-metadata.ts";
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
 * Convert a caught gRPC error into the appropriate `IMessageError` subclass.
 *
 * If the error is not a recognised gRPC error, it is wrapped in the base
 * `IMessageError` with a generic `internalError` code.
 */
export function fromGrpcError(error: unknown): IMessageError {
  // ----- Extract fields from a nice-grpc ClientError -----------------------
  const isClientError = error instanceof ClientError;

  let grpcCode: number;
  if (isClientError) {
    grpcCode = error.code;
  } else if (typeof (error as { code?: unknown }).code === "number") {
    grpcCode = (error as { code: number }).code;
  } else {
    grpcCode = Status.UNKNOWN;
  }

  let details: string;
  if (isClientError) {
    details = error.details;
  } else if (typeof (error as { details?: unknown }).details === "string") {
    details = (error as { details: string }).details;
  } else if (error instanceof Error) {
    details = error.message;
  } else {
    details = String(error);
  }

  const errorCode =
    (readMetadataValue(error, "error-code") as ErrorCode | undefined) ??
    ("internalError" as ErrorCode);

  const retryable = readMetadataValue(error, "x-retryable") === "true";

  const cause = error instanceof Error ? error : undefined;

  const options: IMessageErrorOptions = {
    code: errorCode,
    retryable,
    grpcCode,
    cause,
  };

  // ----- Map gRPC status to the right subclass -----------------------------
  switch (grpcCode) {
    case Status.UNAUTHENTICATED:
    case Status.PERMISSION_DENIED:
      return new AuthenticationError(details, options);

    case Status.NOT_FOUND:
      return new NotFoundError(details, options);

    case Status.RESOURCE_EXHAUSTED:
      return new RateLimitError(details, options);

    case Status.INVALID_ARGUMENT:
    case Status.FAILED_PRECONDITION:
      return new ValidationError(details, options);

    case Status.UNAVAILABLE:
    case Status.DEADLINE_EXCEEDED:
      return new ConnectionError(details, options);

    default:
      return new IMessageError(details, options);
  }
}
