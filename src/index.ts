// Client

// Builder
// biome-ignore lint/performance/noBarrelFile: intentional public API surface
export { MessageBuilder } from "./builders/message-builder.js";
export type { AdvancedIMessage, ClientOptions } from "./client.js";
export { createClient } from "./client.js";
// Errors
export {
  AuthenticationError,
  ConnectionError,
  IMessageError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "./errors/imessage-error.js";
// Streaming
export { TypedEventStream } from "./streaming/event-stream.js";
export type { AddressInfo } from "./types/addresses.js";
export type {
  AttachmentInfo,
  AttachmentInput,
  StreamedDownload,
} from "./types/attachments.js";
// Branded types + constructors
export type {
  AttachmentGuid,
  ChatGuid,
  MessageGuid,
  ScheduledMessageId,
} from "./types/branded.js";
export {
  attachmentGuid,
  chatGuid,
  messageGuid,
  scheduledMessageId,
} from "./types/branded.js";
export type { ParsedChatGuid } from "./types/chat-guid.js";
// ChatGuid utilities
export {
  directChat,
  groupChat,
  isDirectChat,
  isGroupChat,
  parseChatGuid,
} from "./types/chat-guid.js";
export type { Chat, CreateChatOptions } from "./types/chats.js";
// Common
export type {
  CommandReceipt,
  Paginated,
  PaginatedPage,
  RetryOptions,
  SendReceipt,
} from "./types/common.js";
// Effects + Reactions
export { MessageEffect, TextEffect } from "./types/effects.js";
// Enums
export type {
  ChatServiceType,
  MessageItemType,
  ScheduledMessageStatus,
  SortDirection,
  TransferState,
} from "./types/enums.js";
// Error codes
export { ErrorCode } from "./types/errors.js";
// Events
export type {
  ChatEvent,
  EventType,
  EventTypeMap,
  GroupChange,
  GroupEvent,
  IMessageEvent,
  LocationEvent,
  MessageEvent,
  PollEvent,
  ScheduleEvent,
} from "./types/events.js";
export type { BackgroundInfo } from "./types/groups.js";
export type { FindMyFriend } from "./types/locations.js";
// Domain types
export type {
  ComposedMessage,
  EmbeddedMediaItem,
  Message,
  MessageListOptions,
  MessagePart,
  MessageStats,
  SendOptions,
  StickerPlacement,
  TextFormatInput,
} from "./types/messages.js";
export type { PollInfo, PollOption, PollVote } from "./types/polls.js";
export { Reaction } from "./types/reactions.js";
export type {
  CreateScheduledMessageOptions,
  ScheduledMessage,
  ScheduledMessagePayload,
  UpdateScheduledMessageOptions,
} from "./types/scheduled-messages.js";
