import { AddressesResource as AddressesImpl } from "./resources/addresses.js";
import { AttachmentsResource as AttachmentsImpl } from "./resources/attachments.js";
import { ChatsResource as ChatsImpl } from "./resources/chats.js";
import type { GroupIcon } from "./resources/groups.js";
import { GroupsResource as GroupsImpl } from "./resources/groups.js";
import { LocationsResource as LocationsImpl } from "./resources/locations.js";
import { MessagesResource as MessagesImpl } from "./resources/messages.js";
import { PollsResource as PollsImpl } from "./resources/polls.js";
import type { TypedEventStream } from "./streaming/event-stream.js";
import { createHttpClients } from "./transport/http-client.js";
import type { MultiServiceAddressInfo } from "./types/addresses.js";
import type {
  AttachmentInfo,
  AttachmentInput,
  DownloadAttachmentChunk,
  UploadAttachmentResult,
} from "./types/attachments.js";
import type {
  Chat,
  CreateChatOptions,
  CreateChatResult,
} from "./types/chats.js";
import type { IdempotencyOptions, RetryOptions } from "./types/common.js";
import type { MessageEffect } from "./types/effects.js";
import type {
  LocationRequestReceipt,
  SharedFriendLocation,
} from "./types/locations.js";
import type {
  CustomizedMiniAppMessage,
  EmbeddedMedia,
  Message,
  MessageListFilter,
  MessageListPage,
  MessagePart,
  MiniAppCardSession,
  MiniAppMessageResult,
  SendOptions,
  SettableMessageReaction,
  StickerPlacement,
} from "./types/messages.js";
import type { Poll } from "./types/polls.js";

/** Options for configuring the Advanced iMessage client. */
export interface ClientOptions {
  /**
   * The HTTP middleware address: `host[:port]` or a full `http(s)://` URL
   * (e.g. `"imessage.example.com"` or `"http://localhost:8080"`).
   */
  readonly address: string;
  /** When `true`, adds an `x-idempotency-key` header to mutating calls. */
  readonly autoIdempotency?: boolean;
  /** Retries calls the server explicitly marked retryable. */
  readonly retry?: boolean | RetryOptions;
  /** Default per-call timeout in milliseconds. */
  readonly timeout?: number;
  /** Use HTTPS for bare addresses. Defaults to `true`; set `false` for local development. */
  readonly tls?: boolean;
  /** Bearer token, or async function that returns a fresh bearer token per call. */
  readonly token: string | (() => Promise<string>);
}

/**
 * Address APIs.
 *
 * - `get(address)` returns the server's known address record, country, and
 *   available transport services.
 * - `isFocusSilenced(address)` checks whether this device's Focus settings
 *   would silence notifications from the address.
 * - `isIMessageAvailable(address)` checks live iMessage reachability.
 */
export interface AddressesResource {
  get(address: string): Promise<MultiServiceAddressInfo>;
  isFocusSilenced(address: string): Promise<boolean>;
  isIMessageAvailable(address: string): Promise<boolean>;
}

/**
 * Attachment APIs.
 *
 * - `get(attachment)` fetches metadata for an uploaded or received
 *   attachment.
 * - `upload(input)` uploads file bytes and optional Live Photo companion
 *   data.
 * - `downloadStream(attachment)` streams a header frame followed by byte
 *   chunks.
 */
export interface AttachmentsResource {
  downloadStream(attachment: string): TypedEventStream<DownloadAttachmentChunk>;
  get(attachment: string): Promise<AttachmentInfo>;
  upload(input: AttachmentInput): Promise<UploadAttachmentResult>;
}

/**
 * Chat APIs.
 *
 * - `create(addresses, options)` creates a direct or group chat, optionally
 *   with an opening message.
 * - `get(chat)` fetches one chat by guid.
 * - `count(options)` counts visible chats, optionally including archived
 *   chats.
 * - `hasBackground(chat)` checks whether a chat has a custom background.
 * - `setBackground(chat, data)` replaces a chat background image.
 * - `removeBackground(chat)` clears a chat background image.
 * - `markRead(chat)` marks every unread message in the chat as read.
 * - `shareContactInfo(chat)` sends the local account's contact card.
 * - `setTyping(chat, isTyping)` starts or stops the transient typing
 *   indicator.
 */
export interface ChatsResource {
  count(options?: { includeArchived?: boolean }): Promise<number>;
  create(
    addresses: string[],
    options?: CreateChatOptions
  ): Promise<CreateChatResult>;
  get(chat: string): Promise<Chat>;
  hasBackground(chat: string): Promise<boolean>;
  markRead(chat: string): Promise<void>;
  removeBackground(chat: string): Promise<void>;
  setBackground(chat: string, data: Uint8Array): Promise<void>;
  setTyping(chat: string, isTyping: boolean): Promise<void>;
  shareContactInfo(chat: string): Promise<void>;
}

/**
 * Group APIs.
 *
 * - `setDisplayName(chat, displayName, options)` renames a group chat.
 * - `addParticipants(chat, addresses, options)` invites addresses into a
 *   group chat.
 * - `removeParticipants(chat, addresses, options)` removes addresses from a
 *   group chat.
 * - `leave(chat, options)` makes the local account leave a group chat.
 * - `setIcon(chat, data, options)` replaces the group photo.
 * - `getIcon(chat)` downloads the group photo bytes and MIME type.
 * - `removeIcon(chat, options)` clears the group photo.
 */
export interface GroupsResource {
  addParticipants(
    chat: string,
    addresses: string[],
    options?: IdempotencyOptions
  ): Promise<Chat>;
  getIcon(chat: string): Promise<GroupIcon>;
  leave(chat: string, options?: IdempotencyOptions): Promise<void>;
  removeIcon(chat: string, options?: IdempotencyOptions): Promise<void>;
  removeParticipants(
    chat: string,
    addresses: string[],
    options?: IdempotencyOptions
  ): Promise<Chat>;
  setDisplayName(
    chat: string,
    displayName: string,
    options?: IdempotencyOptions
  ): Promise<Chat>;
  setIcon(
    chat: string,
    data: Uint8Array,
    options?: IdempotencyOptions
  ): Promise<void>;
}

/**
 * Shared-location APIs.
 *
 * - `list()` returns every friend currently sharing a location.
 * - `get(address)` fetches the latest snapshot for one friend.
 * - `request(chat, address)` sends a visible Find My request card.
 * - `watch(address?)` streams location updates outside the durable event log.
 */
export interface LocationsResource {
  get(address: string): Promise<SharedFriendLocation>;
  list(): Promise<SharedFriendLocation[]>;
  request(
    chat: string,
    address: string,
    options?: IdempotencyOptions
  ): Promise<LocationRequestReceipt>;
}

/**
 * Message APIs.
 *
 * - `sendText(chat, text, options)` sends text with replies, subjects,
 *   effects, rich links, data-detector scanning, and formatting.
 * - `sendAttachment(chat, attachment, options)` sends an uploaded attachment
 *   by GUID with replies, effects, and audio-message mode.
 * - `sendMultipart(chat, parts, options)` sends multiple text / attachment /
 *   mention bubbles atomically.
 * - `sendCustomizedMiniApp(chat, message, options)` sends a mini app card
 *   backed by the caller's own iMessage extension and returns the session
 *   needed for updates.
 * - `updateCustomizedMiniApp(session, message, options)` updates a caller-owned
 *   mini app card in place.
 * - `edit(chat, message, newText, options)` edits an existing message.
 * - `unsend(chat, message, options)` retracts an existing message.
 * - `setReaction(chat, message, reaction, isSet, options)` adds or removes
 *   a tapback / emoji reaction.
 * - `placeSticker(chat, message, sticker, placement, options)` places an
 *   uploaded sticker attachment on a message.
 * - `notifySilenced(chat, message, options)` triggers Apple's Notify Anyway
 *   action for a Focus-silenced conversation.
 * - `get(message)` fetches one message by its guid.
 * - `listRecent(filter)` pages through recent messages across chats.
 * - `listInChat(chat, filter)` pages through messages in one chat.
 * - `getEmbeddedMedia(chat, message)` downloads Digital Touch / handwritten
 *   embedded media bytes.
 */
export interface MessagesResource {
  edit(
    chat: string,
    message: string,
    newText: string,
    options?: {
      readonly backwardCompatText?: string;
      readonly clientMessageId?: string;
      readonly partIndex?: number;
    }
  ): Promise<Message>;
  get(message: string): Promise<Message>;
  getEmbeddedMedia(chat: string, message: string): Promise<EmbeddedMedia>;
  listInChat(
    chat: string,
    options?: MessageListFilter
  ): Promise<MessageListPage>;
  listRecent(options?: MessageListFilter): Promise<MessageListPage>;
  notifySilenced(
    chat: string,
    message: string,
    options?: { readonly clientMessageId?: string }
  ): Promise<void>;
  placeSticker(
    chat: string,
    message: string,
    sticker: string,
    placement: StickerPlacement,
    options?: { readonly clientMessageId?: string; readonly partIndex?: number }
  ): Promise<Message>;
  sendAttachment(
    chat: string,
    attachment: string,
    options?: {
      readonly clientMessageId?: string;
      readonly effect?: MessageEffect;
      readonly isAudioMessage?: boolean;
      readonly replyTo?: SendOptions["replyTo"];
    }
  ): Promise<Message>;
  sendCustomizedMiniApp(
    chat: string,
    message: CustomizedMiniAppMessage,
    options?: IdempotencyOptions
  ): Promise<MiniAppMessageResult>;
  sendMultipart(
    chat: string,
    parts: readonly MessagePart[],
    options?: {
      readonly clientMessageId?: string;
      readonly enableDataDetection?: boolean;
      readonly effect?: MessageEffect;
      readonly replyTo?: SendOptions["replyTo"];
      readonly subject?: string;
    }
  ): Promise<Message>;
  sendText(chat: string, text: string, options?: SendOptions): Promise<Message>;
  setReaction(
    chat: string,
    message: string,
    reaction: SettableMessageReaction,
    isSet: boolean,
    options?: { readonly clientMessageId?: string; readonly partIndex?: number }
  ): Promise<Message>;
  unsend(
    chat: string,
    message: string,
    options?: { readonly clientMessageId?: string; readonly partIndex?: number }
  ): Promise<void>;
  updateCustomizedMiniApp(
    session: MiniAppCardSession,
    message: CustomizedMiniAppMessage,
    options?: IdempotencyOptions
  ): Promise<MiniAppMessageResult>;
}

/**
 * Poll APIs.
 *
 * - `create(chat, title, choices, options)` creates a poll message.
 * - `get(pollMessage)` reads the latest poll state.
 * - `vote(pollMessage, optionId, options)` casts or changes the local
 *   account's vote.
 * - `unvote(pollMessage, options)` removes the local account's vote.
 * - `addOption(pollMessage, text, options)` appends a new choice.
 */
export interface PollsResource {
  addOption(
    pollMessage: string,
    text: string,
    options?: IdempotencyOptions
  ): Promise<Poll>;
  create(
    chat: string,
    title: string,
    choices: string[],
    options?: IdempotencyOptions
  ): Promise<Poll>;
  get(pollMessage: string): Promise<Poll>;
  unvote(pollMessage: string, options?: IdempotencyOptions): Promise<Poll>;
  vote(
    pollMessage: string,
    optionId: string,
    options?: IdempotencyOptions
  ): Promise<Poll>;
}

export interface AdvancedIMessage extends AsyncDisposable {
  /**
   * Address APIs.
   *
   * - `get(address)` returns the server's known address record, country, and
   *   available transport services.
   * - `isFocusSilenced(address)` checks whether this device's Focus settings
   *   would silence notifications from the address.
   * - `isIMessageAvailable(address)` checks live iMessage reachability.
   */
  readonly addresses: AddressesResource;
  /**
   * Attachment APIs.
   *
   * - `get(attachment)` fetches metadata for an uploaded or received
   *   attachment.
   * - `upload(input)` uploads file bytes and optional Live Photo companion
   *   data.
   * - `downloadStream(attachment)` streams a header frame followed by byte
   *   chunks.
   */
  readonly attachments: AttachmentsResource;
  /**
   * Chat APIs.
   *
   * - `create(addresses, options)` creates a direct or group chat, optionally
   *   with an opening message.
   * - `get(chat)` fetches one chat by guid.
   * - `count(options)` counts visible chats, optionally including archived
   *   chats.
   * - `hasBackground(chat)` checks whether a chat has a custom background.
   * - `setBackground(chat, data)` replaces a chat background image.
   * - `removeBackground(chat)` clears a chat background image.
   * - `markRead(chat)` marks every unread message in the chat as read.
   * - `shareContactInfo(chat)` sends the local account's contact card.
   * - `setTyping(chat, isTyping)` starts or stops the transient typing
   *   indicator.
   */
  readonly chats: ChatsResource;
  close(): Promise<void>;
  /**
   * Group APIs.
   *
   * - `setDisplayName(chat, displayName, options)` renames a group chat.
   * - `addParticipants(chat, addresses, options)` invites addresses into a
   *   group chat.
   * - `removeParticipants(chat, addresses, options)` removes addresses from a
   *   group chat.
   * - `leave(chat, options)` makes the local account leave a group chat.
   * - `setIcon(chat, data, options)` replaces the group photo.
   * - `getIcon(chat)` downloads the group photo bytes and MIME type.
   * - `removeIcon(chat, options)` clears the group photo.
   */
  readonly groups: GroupsResource;
  /**
   * Shared-location APIs.
   *
   * - `list()` returns every friend currently sharing a location.
   * - `get(address)` fetches the latest snapshot for one friend.
   */
  readonly locations: LocationsResource;
  /**
   * Message APIs.
   *
   * - `sendText(chat, text, options)` sends text with replies, subjects,
   *   effects, link previews, data-detector scanning, and formatting.
   * - `sendAttachment(chat, attachment, options)` sends an uploaded attachment
   *   by GUID with replies, effects, and audio-message mode.
   * - `sendMultipart(chat, parts, options)` sends multiple text / attachment /
   *   mention bubbles atomically.
   * - `sendCustomizedMiniApp(chat, message, options)` sends a mini app card
   *   backed by the caller's own iMessage extension and returns the session
   *   needed for updates.
   * - `updateCustomizedMiniApp(session, message, options)` updates a
   *   caller-owned mini app card in place.
   * - `edit(chat, message, newText, options)` edits an existing message.
   * - `unsend(chat, message, options)` retracts an existing message.
   * - `setReaction(chat, message, reaction, isSet, options)` adds or removes
   *   a tapback / emoji reaction.
   * - `placeSticker(chat, message, sticker, placement, options)` places an
   *   uploaded sticker attachment on a message.
   * - `notifySilenced(chat, message, options)` triggers Apple's Notify Anyway
   *   action for a Focus-silenced conversation.
   * - `get(message)` fetches one message by its guid.
   * - `listRecent(filter)` pages through recent messages across chats.
   * - `listInChat(chat, filter)` pages through messages in one chat.
   * - `getEmbeddedMedia(chat, message)` downloads Digital Touch / handwritten
   *   embedded media bytes.
   */
  readonly messages: MessagesResource;
  /**
   * Poll APIs.
   *
   * - `create(chat, title, choices, options)` creates a poll message.
   * - `get(pollMessage)` reads the latest poll state.
   * - `vote(pollMessage, optionId, options)` casts or changes the local
   *   account's vote.
   * - `unvote(pollMessage, options)` removes the local account's vote.
   * - `addOption(pollMessage, text, options)` appends a new choice.
   */
  readonly polls: PollsResource;
}

/**
 * Creates an Advanced iMessage client with typed resource namespaces.
 *
 * Call {@link AdvancedIMessage.close} to release the underlying connection when done.
 *
 * @example
 * ```ts
 * const im = createClient({
 *   address: "localhost:50051",
 *   token: "my-api-token",
 * });
 *
 * await im.close();
 * ```
 */
export function createClient(options: ClientOptions): AdvancedIMessage {
  const clients = createHttpClients({
    address: options.address,
    autoIdempotency: options.autoIdempotency,
    retry: options.retry,
    timeout: options.timeout,
    tls: options.tls,
    token: options.token,
  });

  const messages = new MessagesImpl(clients.messages);
  const chats = new ChatsImpl(clients.chats);
  const groups = new GroupsImpl(clients.groups);
  const attachments = new AttachmentsImpl(clients.attachments);
  const addresses = new AddressesImpl(clients.addresses);
  const polls = new PollsImpl(clients.polls);
  const locations = new LocationsImpl(clients.locations);

  function close(): Promise<void> {
    // Stateless transport: nothing to tear down. Kept for API compatibility.
    return Promise.resolve();
  }

  return {
    messages,
    chats,
    groups,
    attachments,
    addresses,
    polls,
    locations,
    close,
    async [Symbol.asyncDispose](): Promise<void> {
      await close();
    },
  };
}
