/**
 * Chat-related domain types.
 *
 * Wraps the proto `Chat` with branded GUIDs, SDK-friendly enums, and
 * references to other domain types.
 */

import type { AddressInfo } from "./addresses.js";
import type { ChatGuid } from "./branded.js";
import type { ChatServiceType } from "./enums.js";
import type { Message } from "./messages.js";

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** A conversation (direct or group) in iMessage. */
export interface Chat {
  /** Escape hatch to the underlying proto message. */
  readonly _raw?: unknown;
  /** The chat identifier as stored by the system. */
  readonly chatIdentifier?: string;
  /** User-visible display name of the chat. */
  readonly displayName?: string;
  /** Group identifier used internally by the server. */
  readonly groupId?: string;
  /** Unique chat identifier (e.g. "iMessage;-;+1234567890"). */
  readonly guid: ChatGuid;
  /** Whether the chat has been archived. */
  readonly isArchived: boolean;
  /** Whether the chat has been filtered (e.g. from unknown senders). */
  readonly isFiltered: boolean;
  /** Whether this is a group chat (as opposed to a 1:1 direct chat). */
  readonly isGroup: boolean;
  /** The most recent message in this chat, when requested. */
  readonly lastMessage?: Message;
  /** Addresses of participants in this chat. */
  readonly participants: readonly AddressInfo[];
  /** The underlying transport service. */
  readonly service: ChatServiceType;
  /** Number of unread messages, when available. */
  readonly unreadCount?: number;
}

// ---------------------------------------------------------------------------
// CreateChatOptions
// ---------------------------------------------------------------------------

/** Optional parameters for creating a new chat. */
export interface CreateChatOptions {
  /** Client-provided idempotency key for the initial message. */
  readonly clientMessageId?: string;
  /** Full-screen or bubble effect for the initial message. */
  readonly effectId?: string;
  /** Initial message text to send with the chat creation. */
  readonly message?: string;
  /** Transport service to use for the new chat. */
  readonly service?: ChatServiceType;
  /** Subject line for the initial message. */
  readonly subject?: string;
}
