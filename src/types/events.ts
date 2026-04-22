/**
 * Event types for the iMessage event stream.
 *
 * All events are modelled as discriminated unions with `readonly` properties
 * so that TypeScript narrows the type automatically in `if`/`switch` blocks.
 *
 * The {@link EventTypeMap} provides a mapping from event-type string literal
 * to the concrete event shape, enabling type-safe `subscribe()` overloads.
 */

import type { ChatGuid, MessageGuid } from "./branded.ts";
import type { FindMyFriend } from "./locations.ts";
import type { Message } from "./messages.ts";
import type { PollActor, PollChangeDelta } from "./polls.ts";

// ---------------------------------------------------------------------------
// MessageEvent
// ---------------------------------------------------------------------------

/** Events related to individual messages. */
export type MessageEvent =
  | {
      readonly type: "message.sent";
      readonly timestamp: Date;
      readonly message: Message;
      readonly clientMessageId?: string;
      readonly chatGuid: ChatGuid;
      readonly cursor?: string;
    }
  | {
      readonly type: "message.received";
      readonly timestamp: Date;
      readonly message: Message;
      readonly chatGuid: ChatGuid;
      readonly cursor?: string;
    }
  | {
      readonly type: "message.updated";
      readonly timestamp: Date;
      readonly message: Message;
      readonly updateType: "edited" | "unsent" | "notified" | "reaction";
      readonly chatGuid: ChatGuid;
      readonly cursor?: string;
    };

// ---------------------------------------------------------------------------
// ChatEvent
// ---------------------------------------------------------------------------

/** Events related to chat-level state changes. */
export type ChatEvent =
  | {
      readonly type: "chat.created";
      readonly timestamp: Date;
      readonly chatGuid: ChatGuid;
    }
  | {
      readonly type: "chat.left";
      readonly timestamp: Date;
      readonly chatGuid: ChatGuid;
    }
  | {
      readonly type: "chat.readStatusChanged";
      readonly timestamp: Date;
      readonly chatGuid: ChatGuid;
      readonly isRead: boolean;
    }
  | {
      readonly type: "chat.typingIndicator";
      readonly timestamp: Date;
      readonly chatGuid: ChatGuid;
      readonly isTyping: boolean;
      readonly displayName?: string;
    };

// ---------------------------------------------------------------------------
// GroupChange
// ---------------------------------------------------------------------------

/** Discriminated union describing the specific change within a group chat. */
export type GroupChange =
  | { readonly type: "renamed"; readonly name: string }
  | { readonly type: "participantAdded"; readonly address: string }
  | { readonly type: "participantRemoved"; readonly address: string }
  | { readonly type: "iconChanged" }
  | { readonly type: "iconRemoved" }
  | { readonly type: "backgroundChanged" }
  | { readonly type: "backgroundRemoved" };

// ---------------------------------------------------------------------------
// GroupEvent
// ---------------------------------------------------------------------------

/** An event indicating a group chat property was changed. */
export interface GroupEvent {
  readonly change: GroupChange;
  readonly chatGuid: ChatGuid;
  readonly timestamp: Date;
  readonly type: "group.changed";
}

// ---------------------------------------------------------------------------
// PollEvent
// ---------------------------------------------------------------------------

/**
 * An event indicating a poll was created or interacted with.
 *
 * The event is self-contained — the `delta` discriminated union carries the
 * full post-change data for `created` / `optionAdded`, or the voter's
 * current full selection for `voted`. No `polls.get()` round-trip is
 * required for common UI rendering.
 *
 * Switch on `delta.type` (or equivalently `action`) to narrow the payload.
 */
export interface PollEvent {
  /**
   * Action discriminator — mirrors `delta.type`. Convenience alias for
   * callers that only need to branch on the action kind.
   */
  readonly action: PollChangeDelta["type"];
  /** Who made the change. */
  readonly actor: PollActor;
  /**
   * When the change was written (the triggering message's dateCreated).
   * May differ slightly from the event's delivery time.
   */
  readonly at: Date;
  /** Chat the poll belongs to. */
  readonly chatGuid: ChatGuid;
  /** The action and its per-action payload. */
  readonly delta: PollChangeDelta;
  /** GUID of the root poll message (stable across the poll's lifetime). */
  readonly pollMessageGuid: MessageGuid;
  /** The delivery timestamp assigned by the server stream. */
  readonly timestamp: Date;
  readonly type: "poll.changed";
}

// ---------------------------------------------------------------------------
// LocationEvent
// ---------------------------------------------------------------------------

/** An event containing updated FindMy friend locations. */
export interface LocationEvent {
  readonly friends: readonly FindMyFriend[];
  readonly timestamp: Date;
  readonly type: "location.updated";
}

// ---------------------------------------------------------------------------
// IMessageEvent (top-level union)
// ---------------------------------------------------------------------------

/** Union of every possible event emitted by the iMessage event stream. */
export type IMessageEvent =
  | MessageEvent
  | ChatEvent
  | GroupEvent
  | PollEvent
  | LocationEvent;

// ---------------------------------------------------------------------------
// EventTypeMap
// ---------------------------------------------------------------------------

/**
 * Maps each event-type string literal to its concrete event shape.
 *
 * Used by `subscribe()` overloads to narrow the returned event type when a
 * specific event type string is provided.
 */
export interface EventTypeMap {
  "chat.created": Extract<ChatEvent, { type: "chat.created" }>;
  "chat.left": Extract<ChatEvent, { type: "chat.left" }>;
  "chat.readStatusChanged": Extract<
    ChatEvent,
    { type: "chat.readStatusChanged" }
  >;
  "chat.typingIndicator": Extract<ChatEvent, { type: "chat.typingIndicator" }>;
  "group.changed": GroupEvent;
  "location.updated": LocationEvent;
  "message.received": Extract<MessageEvent, { type: "message.received" }>;
  "message.sent": Extract<MessageEvent, { type: "message.sent" }>;
  "message.updated": Extract<MessageEvent, { type: "message.updated" }>;
  "poll.changed": PollEvent;
}

/** Union of all known event-type string literals. */
export type EventType = keyof EventTypeMap;
