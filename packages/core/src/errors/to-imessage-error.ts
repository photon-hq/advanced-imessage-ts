import { ErrorCode } from "../types/errors.ts";
import { IMessageError } from "./imessage-error.ts";

/** Numeric gRPC `UNKNOWN` status (mirrors `nice-grpc-common` Status.UNKNOWN). */
const GRPC_STATUS_UNKNOWN = 2;

/**
 * Normalize an unknown thrown value into an {@link IMessageError}.
 *
 * Transport layers throw fully classified `IMessageError` subclasses; this
 * guard wraps anything else (plain `Error`s from argument validation,
 * unexpected runtime failures) in the base class with a generic
 * `internalError` code.
 */
export function toIMessageError(error: unknown): IMessageError {
  if (error instanceof IMessageError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  return new IMessageError(message, {
    cause: error instanceof Error ? error : undefined,
    code: ErrorCode.internalError,
    context: {},
    grpcCode: GRPC_STATUS_UNKNOWN,
    retryable: false,
  });
}
