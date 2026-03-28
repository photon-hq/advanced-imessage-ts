/**
 * Chat-related domain types.
 *
 * Wraps the proto `Chat` with branded GUIDs, SDK-friendly enums, and
 * references to other domain types.
 */

import type { ChatGuid } from "./branded.js";
import type { ChatServiceType } from "./enums.js";
import type { AddressInfo } from "./addresses.js";
import type { Message } from "./messages.js";

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** A conversation (direct or group) in iMessage. */
export interface Chat {
  /** Unique chat identifier (e.g. "iMessage;-;+1234567890"). */
  readonly guid: ChatGuid;
  /** The chat identifier as stored by the system. */
  readonly chatIdentifier?: string;
  /** Group identifier used internally by the server. */
  readonly groupId?: string;
  /** User-visible display name of the chat. */
  readonly displayName?: string;
  /** Whether this is a group chat (as opposed to a 1:1 direct chat). */
  readonly isGroup: boolean;
  /** The underlying transport service. */
  readonly service: ChatServiceType;
  /** Whether the chat has been archived. */
  readonly isArchived: boolean;
  /** Whether the chat has been filtered (e.g. from unknown senders). */
  readonly isFiltered: boolean;
  /** Number of unread messages, when available. */
  readonly unreadCount?: number;
  /** Addresses of participants in this chat. */
  readonly participants: readonly AddressInfo[];
  /** The most recent message in this chat, when requested. */
  readonly lastMessage?: Message;
  /** Escape hatch to the underlying proto message. */
  readonly _raw?: unknown;
}

// ---------------------------------------------------------------------------
// CreateChatOptions
// ---------------------------------------------------------------------------

/** Optional parameters for creating a new chat. */
export interface CreateChatOptions {
  /** Initial message text to send with the chat creation. */
  readonly message?: string;
  /** Transport service to use for the new chat. */
  readonly service?: ChatServiceType;
  /** Full-screen or bubble effect for the initial message. */
  readonly effectId?: string;
  /** Subject line for the initial message. */
  readonly subject?: string;
  /** Client-provided idempotency key for the initial message. */
  readonly clientMessageId?: string;
}
