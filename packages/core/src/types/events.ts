/**
 * Event types for live subscriptions and durable catch-up replay.
 */

import type { SingleServiceAddressInfo } from "./addresses.js";
import type { Message, MessageReaction, StickerPlacement } from "./messages.js";
import type { PollChangeDelta } from "./polls.js";

export interface EventContext {
  readonly actor?: SingleServiceAddressInfo;
  readonly chatGuid: string;
  readonly isFromMe: boolean;
  readonly occurredAt: Date;
}

export type ChatEvent =
  | (EventContext & {
      readonly type: "chat.backgroundChanged";
      readonly sequence: number;
    })
  | (EventContext & {
      readonly type: "chat.backgroundRemoved";
      readonly sequence: number;
    })
  | (EventContext & {
      readonly type: "chat.markedRead";
      readonly sequence: number;
    })
  | (EventContext & {
      readonly type: "chat.archived";
      readonly sequence: number;
    })
  | (EventContext & {
      readonly type: "chat.unarchived";
      readonly sequence: number;
    });

export type GroupChange =
  | { readonly type: "displayNameChanged"; readonly displayName: string }
  | {
      readonly type: "participantAdded";
      readonly participant: SingleServiceAddressInfo;
    }
  | {
      readonly type: "participantRemoved";
      readonly participant: SingleServiceAddressInfo;
    }
  | {
      readonly type: "participantLeft";
      readonly participant: SingleServiceAddressInfo;
    }
  | { readonly type: "iconChanged" }
  | { readonly type: "iconRemoved" };

export interface GroupEvent extends EventContext {
  readonly change: GroupChange;
  readonly sequence: number;
  readonly type: "group.changed";
}

export type MessageEvent =
  | (EventContext & {
      readonly type: "message.received";
      readonly sequence: number;
      readonly message: Message;
    })
  | (EventContext & {
      readonly type: "message.edited";
      readonly sequence: number;
      readonly messageGuid: string;
      readonly content: Message["content"];
      readonly editedAt: Date;
    })
  | (EventContext & {
      readonly type: "message.read";
      readonly sequence: number;
      readonly messageGuid: string;
      readonly readAt: Date;
    })
  | (EventContext & {
      readonly type: "message.unsent";
      readonly sequence: number;
      readonly messageGuid: string;
      readonly retractedAt: Date;
    })
  | (EventContext & {
      readonly type: "message.reactionAdded";
      readonly sequence: number;
      readonly messageGuid: string;
      readonly reaction: MessageReaction;
      readonly targetPartIndex?: number;
    })
  | (EventContext & {
      readonly type: "message.reactionRemoved";
      readonly sequence: number;
      readonly messageGuid: string;
      readonly reaction: MessageReaction;
      readonly targetPartIndex?: number;
    })
  | (EventContext & {
      readonly type: "message.stickerPlaced";
      readonly sequence: number;
      readonly messageGuid: string;
      readonly sticker?: Message["placedStickers"][number]["sticker"];
      readonly placement?: StickerPlacement;
      readonly targetPartIndex?: number;
    });

export interface PollEvent extends EventContext {
  readonly delta: PollChangeDelta;
  readonly pollMessageGuid: string;
  readonly sequence: number;
  readonly type: "poll.changed";
}

// Note: location updates are NOT in `LiveEvent` / `CatchUpEvent`. They live
// on a separate dedicated stream (`im.locations.watch(...)`) and never flow
// through the durable event log.
export type LiveEvent = MessageEvent | ChatEvent | GroupEvent | PollEvent;

export type CatchUpEvent =
  | LiveEvent
  | {
      readonly type: "catchup.complete";
      readonly headSequence: number;
    };

export interface EventTypeMap {
  "chat.archived": Extract<ChatEvent, { type: "chat.archived" }>;
  "chat.backgroundChanged": Extract<
    ChatEvent,
    { type: "chat.backgroundChanged" }
  >;
  "chat.backgroundRemoved": Extract<
    ChatEvent,
    { type: "chat.backgroundRemoved" }
  >;
  "chat.markedRead": Extract<ChatEvent, { type: "chat.markedRead" }>;
  "chat.unarchived": Extract<ChatEvent, { type: "chat.unarchived" }>;
  "group.changed": GroupEvent;
  "message.edited": Extract<MessageEvent, { type: "message.edited" }>;
  "message.reactionAdded": Extract<
    MessageEvent,
    { type: "message.reactionAdded" }
  >;
  "message.reactionRemoved": Extract<
    MessageEvent,
    { type: "message.reactionRemoved" }
  >;
  "message.read": Extract<MessageEvent, { type: "message.read" }>;
  "message.received": Extract<MessageEvent, { type: "message.received" }>;
  "message.stickerPlaced": Extract<
    MessageEvent,
    { type: "message.stickerPlaced" }
  >;
  "message.unsent": Extract<MessageEvent, { type: "message.unsent" }>;
  "poll.changed": PollEvent;
}

export type EventType = keyof EventTypeMap;
