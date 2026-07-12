// biome-ignore-all lint/performance/noBarrelFile: package root is the shared public surface re-exported by every transport entrypoint.

// Errors
export {
  AuthenticationError,
  ConnectionError,
  IMessageError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "./errors/imessage-error.ts";
// Event parsing (proto3-JSON → public event types, for Fusor envelopes)
export {
  parseChatChangeEvent,
  parseGroupChangeEvent,
  parseMessageChangeEvent,
  parsePollChangeEvent,
} from "./events/parse.ts";
// Streaming
export { TypedEventStream } from "./streaming/event-stream.ts";
export type {
  MultiServiceAddressInfo,
  SingleServiceAddressInfo,
} from "./types/addresses.ts";
export type {
  AttachmentInfo,
  AttachmentInput,
  CompanionInfo,
  DownloadAttachmentChunk,
  UploadAttachmentResult,
} from "./types/attachments.ts";
export type {
  Chat,
  CreateChatOptions,
  CreateChatResult,
} from "./types/chats.ts";
// Common
export type { IdempotencyOptions, RetryOptions } from "./types/common.ts";
// Effects
export { MessageEffect, TextEffect } from "./types/effects.ts";
// Enums
export type {
  ChatServiceType,
  MessageItemType,
  TransferState,
} from "./types/enums.ts";
// Error codes
export { ErrorCode } from "./types/errors.ts";
// Events
export type {
  CatchUpEvent,
  ChatEvent,
  EventType,
  EventTypeMap,
  GroupChange,
  GroupEvent,
  LiveEvent,
  MessageEvent,
  PollEvent,
} from "./types/events.ts";
export type { GroupIcon } from "./types/groups.ts";
export type {
  LocationRequestReceipt,
  SharedFriendLocation,
  SharedFriendLocationUpdated,
} from "./types/locations.ts";
// Domain types
export type {
  CustomizedMiniAppMessage,
  EmbeddedMedia,
  EmbeddedMediaItem,
  Message,
  MessageAppliedReaction,
  MessageContent,
  MessageListFilter,
  MessageListPage,
  MessageMention,
  MessagePart,
  MessagePlacedSticker,
  MessageReaction,
  MiniAppCardSession,
  MiniAppLayout,
  MiniAppMessageResult,
  SendOptions,
  SettableMessageReaction,
  StickerPlacement,
  TextFormat,
  TextFormatInput,
} from "./types/messages.ts";
export type {
  Poll,
  PollChangeDelta,
  PollOption,
  PollParticipantVote,
} from "./types/polls.ts";
