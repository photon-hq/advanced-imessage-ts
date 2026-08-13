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

/** Visible fields decoded from an inbound iMessage mini-app card. */
export interface MiniAppLayoutInfo {
  /** Top-left, bold. The most prominent text slot. */
  readonly caption?: string;
  /** Overlay text shown below `imageTitle`, above the image edge. */
  readonly imageSubtitle?: string;
  /** Overlay text shown above the image. */
  readonly imageTitle?: string;
  /** Below `caption`, on the left. */
  readonly subcaption?: string;
  /** Fallback text shown when the full card cannot be rendered. */
  readonly summary?: string;
  /** Top-right. */
  readonly trailingCaption?: string;
  /** Below `trailingCaption`, on the right. */
  readonly trailingSubcaption?: string;
}

/** Public semantic data decoded from an inbound iMessage app-extension balloon. */
export interface MiniAppContent {
  /** Display name embedded by the sending extension. */
  readonly appName?: string;
  /** App Store identifier supplied by the sender. */
  readonly appStoreId?: number;
  /** iMessage extension bundle identifier parsed from the balloon id. */
  readonly extensionBundleId: string;
  /** Visible template fields decoded from the payload. */
  readonly layout?: MiniAppLayoutInfo;
  /** Whether the payload carries live-layout metadata. */
  readonly live: boolean;
  /** Stable session identifier shared by updates to the same card. */
  readonly sessionId?: string;
  /** Apple Team ID parsed from the balloon id. */
  readonly teamId: string;
  /** URL delivered to the extension when the recipient opens the card. */
  readonly url?: string;
}

export interface MessageContent {
  readonly attachments: readonly AttachmentInfo[];
  readonly balloonBundleId?: string;
  readonly expressiveSendStyleId?: string;
  readonly formatting: readonly TextFormat[];
  readonly mentions: readonly MessageMention[];
  readonly miniApp?: MiniAppContent;
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
  /** Full-screen or bubble effect to apply to the outgoing message. */
  readonly effect?: MessageEffect;
  /** Enable Apple's data-detector pass for links, dates, addresses, and similar text. */
  readonly enableDataDetection?: boolean;
  /** Ask Messages to generate rich URL previews when possible. */
  readonly enableLinkPreview?: boolean;
  /** UTF-16 ranges for bold, italic, underline, strikethrough, or text effects. */
  readonly formatting?: readonly TextFormatInput[];
  /** Message guid, or message guid plus multipart bubble index, to reply to. */
  readonly replyTo?:
    | string
    | { readonly guid: string; readonly partIndex?: number };
  /** Optional subject line for the outgoing message. */
  readonly subject?: string;
}

/**
 * Visible layout of an iMessage mini-app card. Mirrors Apple's
 * `MSMessageTemplateLayout`. At least one of `caption`, `subcaption`,
 * `trailingCaption`, `trailingSubcaption`, or `image` must be set;
 * an entirely empty layout renders as a blank bubble and is rejected.
 *
 * Slot map: `caption` / `subcaption` render on the left,
 * `trailingCaption` / `trailingSubcaption` render on the right, and
 * `imageTitle` / `imageSubtitle` overlay `image`.
 * `image` and `imageTitle` must be set together; `imageSubtitle`
 * requires `image`.
 */
export interface MiniAppLayout {
  /** Top-left, bold. The most prominent text slot. */
  readonly caption?: string;
  /** JPEG preview image bytes. */
  readonly image?: Uint8Array;
  /** Overlay text shown below `imageTitle`. Requires `image`. */
  readonly imageSubtitle?: string;
  /** Overlay text shown above the image. Must be set together with `image`. */
  readonly imageTitle?: string;
  /** Below `caption`, on the left. */
  readonly subcaption?: string;
  /** Fallback text for surfaces that cannot render the full card. */
  readonly summary?: string;
  /** Top-right. */
  readonly trailingCaption?: string;
  /** Below `trailingCaption`, on the right. */
  readonly trailingSubcaption?: string;
}

export interface CustomizedMiniAppMessage {
  /** Display name of the owning app, shown by Messages fallback UI. */
  readonly appName: string;
  /** Apple App Store numeric id of the owning app. When set, must be a positive integer. */
  readonly appStoreId?: number;
  /** Bundle identifier of the iMessage extension target. Must not contain `:`. */
  readonly extensionBundleId: string;
  /** Visible card layout. */
  readonly layout: MiniAppLayout;
  /** Render with the installed extension's live UI when available. Defaults to `false`. */
  readonly live?: boolean;
  /** 10-character uppercase alphanumeric Apple Team ID. */
  readonly teamId: string;
  /** Absolute HTTP or HTTPS URL delivered to the installed extension on tap. */
  readonly url: string;
}

/**
 * Stable mini-app card handle returned by mini-app send/update calls. Save it
 * and pass it unchanged to the matching update call.
 */
export interface MiniAppCardSession {
  /** Chat GUID accepted by IMAgentKit for future updates. */
  readonly chatGuid: string;
  /** Message GUID returned by the card send/update primitive. */
  readonly messageGuid: string;
  /** Stable UUID reused across in-place updates. */
  readonly sessionId: string;
  /** Original card bubble GUID that future updates replace in place. */
  readonly targetMessageGuid: string;
}

/** Message snapshot plus the card session needed for later in-place updates. */
export type MiniAppMessageResult = Message & {
  readonly miniAppCardSession: MiniAppCardSession;
};

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
