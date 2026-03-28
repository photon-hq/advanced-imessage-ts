// Client
export { createClient } from "./client.js";
export type { AdvancedIMessage, ClientOptions } from "./client.js";

// Branded types + constructors
export type { ChatGuid, MessageGuid, AttachmentGuid, ScheduledMessageId } from "./types/branded.js";
export { chatGuid, messageGuid, attachmentGuid, scheduledMessageId } from "./types/branded.js";

// ChatGuid utilities
export { directChat, groupChat, parseChatGuid, isDirectChat, isGroupChat } from "./types/chat-guid.js";
export type { ParsedChatGuid } from "./types/chat-guid.js";

// Effects + Reactions
export { MessageEffect, TextEffect } from "./types/effects.js";
export { Reaction } from "./types/reactions.js";

// Enums
export type { SortDirection, TransferState, MessageItemType, ChatServiceType, ScheduledMessageStatus } from "./types/enums.js";

// Error codes
export { ErrorCode } from "./types/errors.js";

// Domain types
export type { Message, SendOptions, TextFormatInput, StickerPlacement, MessagePart, ComposedMessage, MessageListOptions, MessageStats, EmbeddedMediaItem } from "./types/messages.js";
export type { Chat, CreateChatOptions } from "./types/chats.js";
export type { BackgroundInfo } from "./types/groups.js";
export type { AttachmentInfo, AttachmentInput, StreamedDownload } from "./types/attachments.js";
export type { AddressInfo } from "./types/addresses.js";
export type { PollInfo, PollOption, PollVote } from "./types/polls.js";
export type { ScheduledMessage, CreateScheduledMessageOptions, UpdateScheduledMessageOptions } from "./types/scheduled-messages.js";
export type { FindMyFriend } from "./types/locations.js";

// Events
export type { MessageEvent, ChatEvent, GroupEvent, GroupChange, PollEvent, ScheduleEvent, LocationEvent, IMessageEvent, EventTypeMap, EventType } from "./types/events.js";

// Common
export type { SendReceipt, CommandReceipt, Paginated, PaginatedPage, RetryOptions } from "./types/common.js";

// Errors
export { IMessageError, AuthenticationError, NotFoundError, RateLimitError, ValidationError, ConnectionError } from "./errors/imessage-error.js";

// Streaming
export { TypedEventStream } from "./streaming/event-stream.js";

// Builder
export { MessageBuilder } from "./builders/message-builder.js";
