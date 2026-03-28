/**
 * Scheduled-message domain types.
 *
 * Wraps the proto `ScheduledMessage` with branded IDs, `Date` timestamps,
 * and SDK-friendly status enums.
 */

import type { ChatGuid, ScheduledMessageId } from "./branded.js";
import type { ScheduledMessageStatus } from "./enums.js";

// ---------------------------------------------------------------------------
// ScheduledMessage
// ---------------------------------------------------------------------------

/** A message that has been scheduled for future delivery. */
export interface ScheduledMessage {
  /** When this scheduled message record was created. */
  readonly createdAt: Date;
  /** Error description if `status` is `"failed"`. */
  readonly errorMessage?: string;
  /** Server-assigned numeric identifier. */
  readonly id: ScheduledMessageId;
  /** Opaque payload bytes describing what to send. */
  readonly payload: Uint8Array;
  /** Opaque schedule bytes describing recurrence rules. */
  readonly schedule: Uint8Array;
  /** When the message is scheduled to be sent. */
  readonly scheduledFor: Date;
  /** When the message was actually sent, if it has been. */
  readonly sentAt?: Date;
  /** Current lifecycle status. */
  readonly status: ScheduledMessageStatus;
  /** The type of scheduled action (e.g. "sendMessage"). */
  readonly type: string;
}

// ---------------------------------------------------------------------------
// CreateScheduledMessageOptions
// ---------------------------------------------------------------------------

/** Parameters for scheduling a new message. */
export interface CreateScheduledMessageOptions {
  /** The chat to send the message to. */
  readonly chat: ChatGuid;
  /** Optional recurrence schedule. Defaults to a one-time send. */
  readonly schedule?:
    | { readonly type: "once" }
    | { readonly type: "recurring"; readonly intervalSeconds: number };
  /** When to send the message. */
  readonly scheduledFor: Date;
  /** The text content of the message. */
  readonly text: string;
}

// ---------------------------------------------------------------------------
// UpdateScheduledMessageOptions
// ---------------------------------------------------------------------------

/** Parameters for updating an existing scheduled message. All fields are optional. */
export interface UpdateScheduledMessageOptions {
  /** The chat to send the message to. */
  readonly chat?: ChatGuid;
  /** Optional recurrence schedule. */
  readonly schedule?:
    | { readonly type: "once" }
    | { readonly type: "recurring"; readonly intervalSeconds: number };
  /** When to send the message. */
  readonly scheduledFor?: Date;
  /** The text content of the message. */
  readonly text?: string;
}
