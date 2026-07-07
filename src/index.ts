// biome-ignore-all lint/performance/noBarrelFile: package root is the public SDK entrypoint.

// Client

export type {
  AddressesResource,
  AdvancedIMessage,
  AttachmentsResource,
  ChatsResource,
  ClientOptions,
  EventsResource,
  GroupsResource,
  LocationsResource,
  MessagesResource,
  PollsResource,
} from "./client.js";
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
// Resource type re-exports
export type { GroupIcon } from "./resources/groups.js";
// Streaming
export { TypedEventStream } from "./streaming/event-stream.js";
// Transport
export type { GrpcChannelOptions } from "./transport/grpc-client.js";
export type {
  MultiServiceAddressInfo,
  SingleServiceAddressInfo,
} from "./types/addresses.js";
export type {
  AttachmentInfo,
  AttachmentInput,
  CompanionInfo,
  DownloadAttachmentChunk,
  UploadAttachmentResult,
} from "./types/attachments.js";
export type {
  Chat,
  CreateChatOptions,
  CreateChatResult,
} from "./types/chats.js";
// Common
export type {
  HeartbeatHandler,
  IdempotencyOptions,
  RetryOptions,
} from "./types/common.js";
// Effects
export { MessageEffect, TextEffect } from "./types/effects.js";
// Enums
export type {
  ChatServiceType,
  MessageItemType,
  TransferState,
} from "./types/enums.js";
// Error codes
export { ErrorCode } from "./types/errors.js";
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
} from "./types/events.js";
export type {
  LocationRequestReceipt,
  SharedFriendLocation,
  SharedFriendLocationUpdated,
} from "./types/locations.js";
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
} from "./types/messages.js";
export type {
  Poll,
  PollChangeDelta,
  PollOption,
  PollParticipantVote,
} from "./types/polls.js";
