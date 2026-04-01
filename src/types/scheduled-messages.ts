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
// ScheduledMessagePayload
// ---------------------------------------------------------------------------

/**
 * Payload fields for a scheduled send-message action.
 *
 * Mirrors the server's `ScheduledPayloadDTO` JSON schema. `chat` and
 * `projectId` are always required by the server.
 */
export interface ScheduledMessagePayload {
  readonly attachmentName?: string;
  readonly attachmentPath?: string;
  readonly chat: ChatGuid;
  readonly clientMessageId?: string;
  readonly effectId?: string;
  readonly projectId: string;
  readonly service?: string;
  readonly subject?: string;
  readonly text?: string;
}

// ---------------------------------------------------------------------------
// CreateScheduledMessageOptions
// ---------------------------------------------------------------------------

/** Parameters for scheduling a new message. */
export interface CreateScheduledMessageOptions extends ScheduledMessagePayload {
  /** Optional recurrence schedule. Defaults to a one-time send. */
  readonly schedule?:
    | { readonly type: "once" }
    | { readonly type: "recurring"; readonly intervalSeconds: number };
  /** When to send the message. */
  readonly scheduledFor: Date;
}

// ---------------------------------------------------------------------------
// UpdateScheduledMessageOptions
// ---------------------------------------------------------------------------

/**
 * Parameters for updating an existing scheduled message.
 *
 * All payload fields are optional — the SDK fetches the current message and
 * merges your changes before sending the full replacement to the server.
 */
export interface UpdateScheduledMessageOptions {
  readonly attachmentName?: string;
  readonly attachmentPath?: string;
  readonly chat?: ChatGuid;
  readonly clientMessageId?: string;
  readonly effectId?: string;
  readonly projectId?: string;
  readonly schedule?:
    | { readonly type: "once" }
    | { readonly type: "recurring"; readonly intervalSeconds: number };
  readonly scheduledFor?: Date;
  readonly service?: string;
  readonly subject?: string;
  readonly text?: string;
}
