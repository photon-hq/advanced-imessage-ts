/**
 * Message-related domain types.
 */

import type { SingleServiceAddressInfo } from "./addresses.js";
import type { AttachmentInfo } from "./attachments.js";
import type { MessageEffect, TextEffect } from "./effects.js";
import type { MessageItemType } from "./enums.js";

export interface TextFormat {
  readonly effectName?: string;
  readonly length: number;
  readonly start: number;
  readonly type: string;
}

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

export interface MessageMention {
  readonly address: string;
  readonly length: number;
  readonly start: number;
}

export interface MessageReaction {
  readonly emoji?: string;
  readonly kind:
    | "love"
    | "like"
    | "dislike"
    | "laugh"
    | "emphasize"
    | "question"
    | "emoji"
    | "sticker"
    | "unknown";
}

export interface SettableMessageReaction {
  /** Emoji character to send when `kind` is `"emoji"`. */
  readonly emoji?: string;
  /** Tapback family to add or remove. Use `placeSticker(...)` for stickers. */
  readonly kind:
    | "love"
    | "like"
    | "dislike"
    | "laugh"
    | "emphasize"
    | "question"
    | "emoji";
}

export interface StickerPlacement {
  /** Optional clockwise rotation in Apple's normalized coordinate space. */
  readonly rotation?: number;
  /** Optional scale factor for the sticker. */
  readonly scale?: number;
  /** Optional rendered sticker width. */
  readonly width?: number;
  /** Horizontal position in Apple's normalized coordinate space. */
  readonly x: number;
  /** Vertical position in Apple's normalized coordinate space. */
  readonly y: number;
}

export interface MessageContent {
  readonly attachments: readonly AttachmentInfo[];
  readonly balloonBundleId?: string;
  readonly expressiveSendStyleId?: string;
  readonly formatting: readonly TextFormat[];
  readonly mentions: readonly MessageMention[];
  readonly text?: string;
}

export interface MessageAppliedReaction {
  readonly dateCreated: Date;
  readonly isFromMe: boolean;
  readonly messageGuid: string;
  readonly reaction: MessageReaction;
  readonly sender?: SingleServiceAddressInfo;
  readonly targetPartIndex?: number;
}

export interface MessagePlacedSticker {
  readonly dateCreated: Date;
  readonly isFromMe: boolean;
  readonly messageGuid: string;
  readonly placement?: StickerPlacement;
  readonly sender?: SingleServiceAddressInfo;
  readonly sticker?: AttachmentInfo;
  readonly targetPartIndex?: number;
}

export interface Message {
  readonly appliedReactions: readonly MessageAppliedReaction[];
  readonly cachedRoomNames?: string;
  readonly chatActionType?: number;
  readonly chatGuids: readonly string[];
  readonly content: MessageContent;
  readonly dataDetectorResultsPresent: boolean;
  readonly dateCreated: Date;
  readonly dateDelivered?: Date;
  readonly dateEdited?: Date;
  readonly dateExpressiveSendPlayed?: Date;
  readonly datePlayed?: Date;
  readonly dateRead?: Date;
  readonly dateRetracted?: Date;
  readonly destinationCallerId?: string;
  readonly didNotifyRecipient: boolean;
  readonly groupTitle?: string;
  readonly guid: string;
  readonly isArchived: boolean;
  readonly isAudioMessage: boolean;
  readonly isAutoReply: boolean;
  readonly isCorrupt: boolean;
  readonly isDelayed: boolean;
  readonly isDelivered: boolean;
  readonly isDeliveredQuietly: boolean;
  readonly isExpirable: boolean;
  readonly isForward: boolean;
  readonly isFromMe: boolean;
  readonly isSent: boolean;
  readonly isServiceMessage: boolean;
  readonly isSpam: boolean;
  readonly isSystemMessage: boolean;
  readonly itemType: MessageItemType;
  readonly partCount?: number;
  readonly placedStickers: readonly MessagePlacedSticker[];
  readonly reaction?: MessageReaction;
  readonly reactionSelected?: boolean;
  readonly reactionTargetGuid?: string;
  readonly reactionTargetPartIndex?: number;
  readonly replyTargetGuid?: string;
  readonly sendErrorCode: number;
  readonly sender?: SingleServiceAddressInfo;
  readonly shareDirection?: number;
  readonly shareStatus?: number;
  readonly subject?: string;
  readonly threadOriginatorGuid?: string;
  readonly threadOriginatorPart?: string;
}

export interface SendOptions {
  /** Stable idempotency key for this logical send. */
  readonly clientMessageId?: string;
  /** Enable Apple's data-detector pass for links, dates, addresses, and similar text. */
  readonly enableDataDetection?: boolean;
  /** Full-screen or bubble effect to apply to the outgoing message. */
  readonly effect?: MessageEffect;
  /** UTF-16 ranges for bold, italic, underline, strikethrough, or text effects. */
  readonly formatting?: readonly TextFormatInput[];
  /** Message guid, or message guid plus multipart bubble index, to reply to. */
  readonly replyTo?:
    | string
    | { readonly guid: string; readonly partIndex?: number };
  /** Ask Messages to generate rich URL previews when possible. */
  readonly enableLinkPreview?: boolean;
  /** Optional subject line for the outgoing message. */
  readonly subject?: string;
}

export interface MessagePart {
  /** Uploaded attachment guid for an attachment bubble. */
  readonly attachmentGuid?: string;
  /** Optional display name for the attachment bubble. */
  readonly attachmentName?: string;
  /** Server bubble index override for advanced multipart layouts. */
  readonly bubbleIndex?: number;
  /** UTF-16 formatting ranges that apply to this part's `text`. */
  readonly formatting?: readonly TextFormatInput[];
  /** Address represented by this text part when sending an `@` mention. */
  readonly mentionedAddress?: string;
  /** Text for a text or mention bubble. */
  readonly text?: string;
}

/**
 * Filter + paging knobs shared by `messages.listRecent` and `messages.listInChat`.
 *
 * Note: `chatGuid` is *not* on this type. `listInChat` takes it as its own
 * required argument so the type system rejects calling `listRecent({ chatGuid })`
 * (which the server silently ignores).
 */
export interface MessageListFilter {
  /** Return messages created after this time. */
  readonly after?: Date;
  /** Return messages created before this time. */
  readonly before?: Date;
  /** Limit results to outgoing (`true`) or incoming (`false`) messages. */
  readonly isFromMe?: boolean;
  /** Limit results to read (`true`) or unread (`false`) messages. */
  readonly isRead?: boolean;
  /** Number of messages per page. The server currently requires `1..100`. */
  readonly pageSize?: number;
  /** Token returned by the previous page. */
  readonly pageToken?: string;
}

export interface MessageListPage {
  readonly messages: readonly Message[];
  readonly nextPageToken?: string;
}

export interface EmbeddedMediaItem {
  readonly data: Uint8Array;
  readonly mimeType: string;
}

export type EmbeddedMedia = EmbeddedMediaItem;
