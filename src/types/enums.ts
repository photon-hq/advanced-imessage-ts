/**
 * Lightweight string-union enums for the SDK's public API.
 *
 * These replace the generated protobuf numeric enums with human-readable
 * string literals. The mapper layer handles conversion to/from wire values.
 */

// ---------------------------------------------------------------------------
// SortDirection
// ---------------------------------------------------------------------------

/** Sort order for paginated list endpoints. */
export type SortDirection = "ascending" | "descending";

// ---------------------------------------------------------------------------
// TransferState
// ---------------------------------------------------------------------------

/** Current transfer state of an attachment. */
export type TransferState = "transferring" | "failed" | "finished" | "pending";

// ---------------------------------------------------------------------------
// MessageItemType
// ---------------------------------------------------------------------------

/** Discriminates the kind of item a message represents. */
export type MessageItemType =
  | "normal"
  | "groupNameChange"
  | "participantChange"
  | "leftGroup";

// ---------------------------------------------------------------------------
// ChatServiceType
// ---------------------------------------------------------------------------

/** The underlying transport service for a chat. */
export type ChatServiceType = "iMessage" | "SMS";
