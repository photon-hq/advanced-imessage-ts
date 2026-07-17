/**
 * Lightweight string-union enums for the SDK's public API.
 *
 * These replace the generated protobuf numeric enums with human-readable
 * string literals. The mapper layer handles conversion to/from wire values.
 */

// ---------------------------------------------------------------------------
// TransferState
// ---------------------------------------------------------------------------

/** Current transfer state of an attachment. */
export type TransferState =
  | "pending"
  | "transferring"
  | "failed"
  | "finished"
  | "unknown";

// ---------------------------------------------------------------------------
// MessageItemType
// ---------------------------------------------------------------------------

/** Discriminates the kind of item a message represents. */
export type MessageItemType =
  | "normal"
  | "groupNameChange"
  | "participantChange"
  | "chatAction"
  | "unknown";

// ---------------------------------------------------------------------------
// ChatServiceType
// ---------------------------------------------------------------------------

/** The underlying transport service for a chat or address. */
export type ChatServiceType = "iMessage" | "SMS" | "RCS" | "unknown";

/** Sidecar attachment kind. */
export type CompanionKind = "live-photo-video" | "unknown";
