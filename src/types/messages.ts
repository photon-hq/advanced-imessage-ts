/**
 * Message-related domain types.
 *
 * These are the handwritten public types that wrap the generated proto
 * definitions. Branded identifiers prevent mixing GUIDs at compile time,
 * `Date` replaces proto `Timestamp`, and SDK enums replace proto numeric
 * enums.
 */

import type { AddressInfo } from "./addresses.js";
import type { AttachmentInfo } from "./attachments.js";
import type { AttachmentGuid, ChatGuid, MessageGuid } from "./branded.js";
import type { MessageEffect, TextEffect } from "./effects.js";
import type { MessageItemType, SortDirection } from "./enums.js";

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

/** A single iMessage / SMS / RCS message. */
export interface Message {
  // -- Escape hatch ----------------------------------------------------------

  /** Access to the raw proto message for fields not exposed here. */
  readonly _raw?: unknown;
  /** Emoji used in an emoji tapback reaction. */
  readonly associatedMessageEmoji?: string;
  /** The GUID of a message this message is associated with (e.g. a tapback). */
  readonly associatedMessageGuid?: MessageGuid;

  // -- Relations -------------------------------------------------------------

  /** Attachment metadata for files sent with this message. */
  readonly attachments: readonly AttachmentInfo[];
  /** GUIDs of chats this message belongs to. */
  readonly chatGuids: readonly ChatGuid[];
  /** Client-provided idempotency key, if one was supplied when sending. */
  readonly clientMessageId?: string;

  // -- Timeline --------------------------------------------------------------

  /** When the message was created on the sending device. */
  readonly dateCreated: Date;
  /** When the message was delivered to the recipient device. */
  readonly dateDelivered?: Date;
  /** When the message was last edited. */
  readonly dateEdited?: Date;
  /** When an audio message was played by the recipient. */
  readonly datePlayed?: Date;
  /** When the recipient read the message. */
  readonly dateRead?: Date;
  /** When the message was retracted (unsent). */
  readonly dateRetracted?: Date;
  /** Whether the silenced-notification recipient was explicitly notified. */
  readonly didNotifyRecipient: boolean;

  // -- Rich content ----------------------------------------------------------

  /** The expressive send style ID (screen or bubble effect). */
  readonly expressiveSendStyleId?: string;
  /** Server-assigned unique identifier. */
  readonly guid: MessageGuid;

  // -- Flags -----------------------------------------------------------------

  /** Whether this is an audio message. */
  readonly isAudioMessage: boolean;
  /** Whether the message has been delivered to the recipient. */
  readonly isDelivered: boolean;
  /** Whether the message was delivered quietly (notification suppressed). */
  readonly isDeliveredQuietly: boolean;
  /** Whether the local user sent this message. */
  readonly isFromMe: boolean;

  // -- Delivery status -------------------------------------------------------

  /** Whether the message has been accepted for sending. */
  readonly isSent: boolean;
  /** Whether this is a system-generated message (e.g. group change). */
  readonly isSystemMessage: boolean;

  // -- Type / association ----------------------------------------------------

  /** Discriminates the kind of item this message represents. */
  readonly itemType: MessageItemType;

  // -- Runtime ---------------------------------------------------------------

  /** Server-measured latency in milliseconds, when available. */
  readonly latencyMs?: number;
  /** The GUID of the message this is a direct reply to. */
  readonly replyToGuid?: MessageGuid;
  /** Non-zero when the message failed to send. */
  readonly sendErrorCode: number;

  // -- Sender ----------------------------------------------------------------

  /** The sender's address info. Absent for outgoing messages from "me". */
  readonly sender?: AddressInfo;
  /** Subject line (used with MMS-style messages). */
  readonly subject?: string;

  // -- Content ---------------------------------------------------------------

  /** Plain-text body of the message. */
  readonly text?: string;
}

// ---------------------------------------------------------------------------
// TextFormatInput
// ---------------------------------------------------------------------------

/**
 * Discriminated union describing a text formatting instruction.
 *
 * For simple styles (`bold`, `italic`, etc.) only `start` and `length` are
 * needed. For text effects, an additional `effect` field specifies which
 * animation to apply.
 */
export type TextFormatInput =
  | {
      readonly type: "bold";
      readonly start: number;
      readonly length: number;
    }
  | {
      readonly type: "italic";
      readonly start: number;
      readonly length: number;
    }
  | {
      readonly type: "underline";
      readonly start: number;
      readonly length: number;
    }
  | {
      readonly type: "strikethrough";
      readonly start: number;
      readonly length: number;
    }
  | {
      readonly type: "effect";
      readonly start: number;
      readonly length: number;
      readonly effect: TextEffect;
    };

// ---------------------------------------------------------------------------
// StickerPlacement
// ---------------------------------------------------------------------------

/** Coordinates and transform for placing a sticker on a message bubble. */
export interface StickerPlacement {
  readonly rotation?: number;
  readonly scale?: number;
  readonly width?: number;
  readonly x: number;
  readonly y: number;
}

// ---------------------------------------------------------------------------
// SendOptions
// ---------------------------------------------------------------------------

/** Optional parameters for `messages.send()` (the Tier 2 API). */
export interface SendOptions {
  /** A previously uploaded attachment to include. */
  readonly attachment?: AttachmentGuid;
  /** Send as an audio message. */
  readonly audioMessage?: boolean;
  /** Client-provided idempotency key. */
  readonly clientMessageId?: string;
  /** Enable data-detector scanning (links, phone numbers, etc.). */
  readonly ddScan?: boolean;
  /** Full-screen or bubble effect to apply. */
  readonly effect?: MessageEffect;
  /** Inline text formatting instructions. */
  readonly formatting?: readonly TextFormatInput[];
  /** Reply to an existing message, optionally targeting a specific part. */
  readonly replyTo?:
    | MessageGuid
    | { readonly guid: MessageGuid; readonly partIndex?: number };
  /** Enable rich link previews. */
  readonly richLink?: boolean;
  /** Place a sticker on an existing message. */
  readonly sticker?: {
    readonly attachment: AttachmentGuid;
    readonly target: MessageGuid;
    readonly placement?: StickerPlacement;
  };
  /** Subject line. */
  readonly subject?: string;
}

// ---------------------------------------------------------------------------
// MessagePart
// ---------------------------------------------------------------------------

/** A single part within a multi-part composed message. */
export interface MessagePart {
  /** GUID returned by `attachments.upload()`. */
  readonly attachmentGuid?: AttachmentGuid;
  /** Display name for the attachment file. */
  readonly attachmentName?: string;
  /** Formatting instructions for the text in this part. */
  readonly formatting?: readonly TextFormatInput[];
  /** Address to mention (e.g. "john@icloud.com"). */
  readonly mention?: string;
  /** Zero-based part index within the message. */
  readonly partIndex?: number;
  /** Text content for this part. */
  readonly text?: string;
}

// ---------------------------------------------------------------------------
// ComposedMessage
// ---------------------------------------------------------------------------

/**
 * A fully composed multi-part message ready for sending via
 * `messages.sendComposed()` (the Tier 3 API).
 */
export interface ComposedMessage {
  /** Full-screen or bubble effect. */
  readonly effect?: MessageEffect;
  /** Ordered list of message parts. */
  readonly parts: readonly MessagePart[];
  /** Reply to an existing message, optionally targeting a specific part. */
  readonly replyTo?:
    | MessageGuid
    | { readonly guid: MessageGuid; readonly partIndex?: number };
  /** Subject line. */
  readonly subject?: string;
}

// ---------------------------------------------------------------------------
// MessageListOptions
// ---------------------------------------------------------------------------

/** Query parameters for `messages.list()`. */
export interface MessageListOptions {
  /** Return only messages created after this date. */
  readonly after?: Date;
  /**
   * Resume cursor from a stream event. When set, returns messages with
   * ROWID > cursor position, overriding `after`.
   * Sort is forced to ascending by ROWID (chronological order for catch-up).
   * `offset` and `limit` still apply for pagination within catch-up results.
   */
  readonly afterCursor?: string;
  /** Return only messages created before this date. */
  readonly before?: Date;
  /** Restrict to messages in a specific chat. */
  readonly chatGuid?: ChatGuid;
  /** Maximum number of messages per page. */
  readonly limit?: number;
  /** Offset into the result set (for manual pagination). */
  readonly offset?: number;
  /** Sort order for results. */
  readonly sort?: SortDirection;
  /** Include attachment metadata in the response. */
  readonly withAttachments?: boolean;
  /** Include chat metadata in the response. */
  readonly withChats?: boolean;
}

// ---------------------------------------------------------------------------
// FetchMissedOptions
// ---------------------------------------------------------------------------

/** Options for `messages.fetchMissed()`. */
export interface FetchMissedOptions {
  /** Restrict to messages in a specific chat. */
  readonly chatGuid?: ChatGuid;
  /** Maximum number of messages per page. */
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// MessageStats
// ---------------------------------------------------------------------------

/** Aggregate message statistics returned by `messages.stats()`. */
export interface MessageStats {
  readonly received: number;
  readonly sent: number;
  readonly total: number;
}

// ---------------------------------------------------------------------------
// EmbeddedMediaItem
// ---------------------------------------------------------------------------

/** An embedded media item extracted from a rich message (e.g. a link preview image). */
export interface EmbeddedMediaItem {
  readonly data: Uint8Array;
  readonly mimeType: string;
}
