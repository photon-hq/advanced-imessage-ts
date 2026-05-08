/**
 * Chat-related domain types.
 */

import type { SingleServiceAddressInfo } from "./addresses.js";
import type { MessageEffect } from "./effects.js";
import type { ChatServiceType, SendableChatServiceType } from "./enums.js";
import type { Message } from "./messages.js";

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** A conversation (direct or group) in iMessage. */
export interface Chat {
  readonly chatIdentifier?: string;
  readonly displayName: string;
  readonly groupId?: string;
  readonly guid: string;
  readonly isArchived: boolean;
  readonly isFiltered: boolean;
  readonly isGroup: boolean;
  readonly lastMessage?: Message;
  readonly participants: readonly SingleServiceAddressInfo[];
  readonly service: ChatServiceType;
  readonly unreadCount?: number;
}

export interface CreateChatOptions {
  /** Pre-rendered attributed body for the opening message, when supplied. */
  readonly attributedBody?: Uint8Array;
  /** Caller-generated idempotency key for the opening send. */
  readonly clientMessageId?: string;
  /** Full-screen or bubble effect for `message`. */
  readonly effect?: MessageEffect;
  /** Optional opening text sent in the same server call that creates the chat. */
  readonly message?: string;
  /** Transport service to use for the new chat. Defaults to `"iMessage"`. */
  readonly service?: SendableChatServiceType;
  /** Optional subject line for the opening message. */
  readonly subject?: string;
}

/**
 * Result of `chats.create`.
 *
 * `sendReceipt` is present when `options.message` was supplied.
 */
export interface CreateChatResult {
  readonly chat: Chat;
  readonly sendReceipt?: {
    readonly messageGuid: string;
    readonly clientMessageId?: string;
  };
}
