/**
 * Canonical error codes returned by the server.
 *
 * Modelled as an `as const` object so that both the runtime values and the
 * union type are available, with full autocomplete.
 */

export const ErrorCode = {
  // Authentication / authorization
  unauthenticated: "unauthenticated",
  tokenExpired: "tokenExpired",
  tokenBlocked: "tokenBlocked",
  unauthorized: "unauthorized",

  // Rate limiting
  dailyLimitExceeded: "dailyLimitExceeded",
  recipientLimitExceeded: "recipientLimitExceeded",

  // Duplicate
  duplicateMessage: "duplicateMessage",

  // Not found
  chatNotFound: "chatNotFound",
  messageNotFound: "messageNotFound",
  attachmentNotFound: "attachmentNotFound",
  addressNotFound: "addressNotFound",
  pollNotFound: "pollNotFound",

  // Validation / precondition
  invalidArgument: "invalidArgument",
  preconditionFailed: "preconditionFailed",
  operationNotSupported: "operationNotSupported",
  privateApiUnavailable: "privateApiUnavailable",

  // Infrastructure
  serviceUnavailable: "serviceUnavailable",
  timeout: "timeout",
  internalError: "internalError",
  databaseError: "databaseError",
  networkError: "networkError",
} as const;

/** Union of all known error code strings. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
