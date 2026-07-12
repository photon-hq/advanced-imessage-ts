/**
 * Converts the HTTP middleware's error body into the appropriate
 * {@link IMessageError} subclass.
 *
 * The transcoding middleware (imessage-server-v2-http) maps gRPC failures to
 * a JSON body:
 *
 * ```json
 * {
 *   "code": "not_found",              // lowercase gRPC status name — branch on this
 *   "message": "...",
 *   "source": "upstream",             // upstream | spectrum-imessage | middleware
 *   "errorCode": "messageNotFound",   // canonical ErrorCode (error-code trailer)
 *   "retryable": false,               // x-retryable trailer
 *   "context": { "chatGuid": "..." }  // error-context-* trailers
 * }
 * ```
 *
 * The subclass mapping matches `fromGrpcError` exactly, so callers see the
 * identical error surface over HTTP that they saw over gRPC. `source` is
 * carried onto the error, along with a `retryAfter` (ms) parsed from the
 * `Retry-After` response header when the server sent one.
 *
 * A response WITHOUT a usable contract body never came from the middleware
 * (it stamps `x-spectrum-middleware` on everything and always emits the
 * contract) — a load balancer or gateway answered. Those errors get
 * `source: "intermediary"`, transient statuses (408/429/502/503/504)
 * default to `retryable: true` (gRPC UNAVAILABLE semantics), and a bare
 * 500 stays non-retryable (gRPC INTERNAL semantics).
 */

import type { ErrorCode } from "@photon-ai/aim-core/internal";
import {
  AuthenticationError,
  ConnectionError,
  IMessageError,
  type IMessageErrorOptions,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@photon-ai/aim-core/internal";

/** Lowercase gRPC status name → numeric gRPC code (google.rpc.Code). */
const GRPC_CODE_BY_NAME: Readonly<Record<string, number>> = {
  ok: 0,
  cancelled: 1,
  unknown: 2,
  invalid_argument: 3,
  deadline_exceeded: 4,
  not_found: 5,
  already_exists: 6,
  permission_denied: 7,
  resource_exhausted: 8,
  failed_precondition: 9,
  aborted: 10,
  out_of_range: 11,
  unimplemented: 12,
  internal: 13,
  unavailable: 14,
  data_loss: 15,
  unauthenticated: 16,
};

const UNKNOWN = 2;
const INVALID_ARGUMENT = 3;
const DEADLINE_EXCEEDED = 4;
const NOT_FOUND = 5;
const PERMISSION_DENIED = 7;
const RESOURCE_EXHAUSTED = 8;
const FAILED_PRECONDITION = 9;
const INTERNAL = 13;
const UNAVAILABLE = 14;
const UNAUTHENTICATED = 16;

/** Stamped by the middleware on every response it produces. */
export const MIDDLEWARE_MARKER_HEADER = "x-spectrum-middleware";

const MS_PER_SECOND = 1000;
const BODYLESS_RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

/** Parsed shape of the middleware's JSON error body. */
export interface HttpErrorBody {
  readonly code?: string;
  readonly context?: Record<string, string>;
  readonly errorCode?: string;
  readonly message?: string;
  readonly retryable?: boolean;
  readonly source?: string;
}

/** `Retry-After` header (integer seconds or HTTP-date) → milliseconds. */
function parseRetryAfter(headers: Headers | undefined): number | undefined {
  const raw = headers?.get("retry-after");
  if (!raw) {
    return;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * MS_PER_SECOND;
  }
  const dateMs = Date.parse(raw);
  if (Number.isNaN(dateMs)) {
    return;
  }
  return Math.max(dateMs - Date.now(), 0);
}

function toErrorSubclass(
  grpcCode: number,
  details: string,
  options: IMessageErrorOptions
): IMessageError {
  switch (grpcCode) {
    case UNAUTHENTICATED:
    case PERMISSION_DENIED:
      return new AuthenticationError(details, options);

    case NOT_FOUND:
      return new NotFoundError(details, options);

    case RESOURCE_EXHAUSTED:
      return new RateLimitError(details, options);

    case INVALID_ARGUMENT:
    case FAILED_PRECONDITION:
      return new ValidationError(details, options);

    case UNAVAILABLE:
    case DEADLINE_EXCEEDED:
      return new ConnectionError(details, options);

    default:
      return new IMessageError(details, options);
  }
}

/** Best-fit `ErrorCode` for a status-only (contract-less) error. */
function bodylessErrorCode(httpStatus: number): ErrorCode {
  switch (httpStatus) {
    case 408:
    case 504:
      return "timeout";
    case 502:
    case 503:
      return "serviceUnavailable";
    default:
      return "internalError";
  }
}

/**
 * Classify a response that carried no usable contract body: the status is
 * all we have, and it likely came from an intermediary, not the middleware.
 */
function fromBodylessStatus(
  body: HttpErrorBody,
  httpStatus: number,
  headers: Headers | undefined,
  retryAfter: number | undefined
): IMessageError {
  const grpcCode = grpcCodeFromHttpStatus(httpStatus);
  const details =
    body.message ?? `HTTP ${httpStatus} without a middleware error body`;
  const options: IMessageErrorOptions = {
    code: bodylessErrorCode(httpStatus),
    context: body.context ?? {},
    grpcCode,
    retryAfter,
    retryable: body.retryable ?? BODYLESS_RETRYABLE_STATUSES.has(httpStatus),
    source: headers?.has(MIDDLEWARE_MARKER_HEADER)
      ? "middleware"
      : "intermediary",
  };
  return toErrorSubclass(grpcCode, details, options);
}

/**
 * Build the `IMessageError` subclass for a non-2xx middleware response.
 *
 * @param body - The parsed JSON error body (fields may be missing if the
 *               response didn't come from the middleware, e.g. a proxy 502).
 * @param httpStatus - The HTTP status, used only as a fallback when the body
 *                     carries no usable `code`.
 * @param headers - Response headers, for `Retry-After` and the middleware
 *                  marker.
 */
export function fromHttpErrorBody(
  body: HttpErrorBody,
  httpStatus: number,
  headers?: Headers
): IMessageError {
  const retryAfter = parseRetryAfter(headers);
  const contractCode = body.code ? GRPC_CODE_BY_NAME[body.code] : undefined;
  if (contractCode === undefined) {
    return fromBodylessStatus(body, httpStatus, headers, retryAfter);
  }

  const details =
    body.message ?? `HTTP ${httpStatus} without a middleware error body`;
  const options: IMessageErrorOptions = {
    code: (body.errorCode as ErrorCode | undefined) ?? "internalError",
    context: body.context ?? {},
    grpcCode: contractCode,
    retryAfter,
    retryable: body.retryable ?? false,
    source: body.source,
  };
  return toErrorSubclass(contractCode, details, options);
}

/**
 * Wrap a transport-level failure (fetch rejection, aborted request, invalid
 * response body) in a `ConnectionError`, preserving an existing
 * `IMessageError` untouched.
 */
export function fromTransportFailure(error: unknown): IMessageError {
  if (error instanceof IMessageError) {
    return error;
  }
  const cause = error instanceof Error ? error : undefined;
  const timedOut = cause?.name === "TimeoutError";
  return new ConnectionError(cause?.message ?? String(error), {
    code: timedOut ? "timeout" : "networkError",
    context: {},
    retryable: false,
    grpcCode: timedOut ? DEADLINE_EXCEEDED : UNAVAILABLE,
    cause,
  });
}

/**
 * Fallback for responses that skipped the middleware entirely (load
 * balancers, gateways): approximate a gRPC code from the HTTP status using
 * the inverse of grpc-gateway's canonical table.
 */
function grpcCodeFromHttpStatus(status: number): number {
  switch (status) {
    case 400:
      return INVALID_ARGUMENT;
    case 401:
      return UNAUTHENTICATED;
    case 403:
      return PERMISSION_DENIED;
    case 404:
      return NOT_FOUND;
    case 408:
      return DEADLINE_EXCEEDED;
    case 429:
      return RESOURCE_EXHAUSTED;
    case 500:
      return INTERNAL;
    case 502:
    case 503:
      return UNAVAILABLE;
    case 504:
      return DEADLINE_EXCEEDED;
    default:
      return UNKNOWN;
  }
}
