/**
 * MessagesResource -- the largest resource class, covering sending, reacting,
 * editing, unsending, listing, stats, embedded media, and real-time event
 * subscription for iMessages.
 */

import { fromGrpcError } from "../errors/error-handler.ts";
import { SortDirection as ProtoSortDirection } from "../generated/photon/imessage/v1/common.ts";
import type {
  MessageReceivedEvent,
  MessageSendErrorEvent,
  MessageSentEvent,
  MessageUpdatedEvent,
  MessagePart as ProtoMessagePart,
  StickerPlacement as ProtoStickerPlacement,
  TextFormat as ProtoTextFormat,
  SendRequest,
} from "../generated/photon/imessage/v1/message_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import { createPaginated } from "../streaming/paginated.ts";
import type { MessageServiceClient } from "../transport/grpc-client.ts";
import { mapMessage, mapSortDirection } from "../transport/mapper.ts";
import type { ChatGuid, MessageGuid } from "../types/branded.ts";
import { chatGuid, messageGuid } from "../types/branded.ts";
import type {
  CommandReceipt,
  Paginated,
  SendReceipt,
} from "../types/common.ts";
import type { MessageEvent } from "../types/events.ts";
import type {
  ComposedMessage,
  EmbeddedMediaItem,
  Message,
  MessageListOptions,
  MessagePart,
  MessageStats,
  SendOptions,
  TextFormatInput,
} from "../types/messages.ts";
import type { Reaction } from "../types/reactions.ts";
import { unwrap } from "../utils/unwrap.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional noop for promise chain suppression
function noop(): void {}

/**
 * Convert SDK TextFormatInput[] to proto TextFormat[].
 */
function toProtoFormatting(
  formatting: readonly TextFormatInput[] | undefined
): ProtoTextFormat[] {
  if (!formatting) {
    return [];
  }
  return formatting.map((f) => ({
    type: f.type,
    start: f.start,
    length: f.length,
    effectName: f.type === "effect" ? f.effect : undefined,
  }));
}

/**
 * Convert SDK MessagePart[] to proto MessagePart[].
 */
function toProtoMessageParts(
  parts: readonly MessagePart[]
): ProtoMessagePart[] {
  return parts.map((p) => ({
    text: p.text,
    attachmentPath: p.attachmentPath,
    attachmentName: p.attachmentName,
    mention: p.mention,
    partIndex: p.partIndex,
    formatting: toProtoFormatting(p.formatting),
  }));
}

/**
 * Resolve the replyTo option into proto fields (selectedMessageGuid + partIndex).
 */
function resolveReplyTo(
  replyTo: SendOptions["replyTo"]
): { selectedMessageGuid: string; partIndex: number } | undefined {
  if (!replyTo) {
    return undefined;
  }

  if (typeof replyTo === "string") {
    return { selectedMessageGuid: replyTo, partIndex: 0 };
  }

  return {
    selectedMessageGuid: replyTo.guid,
    partIndex: replyTo.partIndex ?? 0,
  };
}

// ---------------------------------------------------------------------------
// MessagesResource
// ---------------------------------------------------------------------------

export class MessagesResource {
  private readonly _client: MessageServiceClient;
  private readonly _chains = new Map<string, Promise<void>>();

  constructor(client: MessageServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // Ordering internals
  // -------------------------------------------------------------------------

  /**
   * Chain a send onto the per-chat promise queue. Sends to the same chat
   * execute sequentially; different chats proceed concurrently.
   */
  private _enqueue<T>(chat: ChatGuid, fn: () => Promise<T>): Promise<T> {
    const prev = this._chains.get(chat) ?? Promise.resolve();

    const task = prev.then(
      () => fn(),
      () => fn()
    );

    const chain = task.then(noop, noop);
    this._chains.set(chat, chain);

    chain.then(() => {
      if (this._chains.get(chat) === chain) {
        this._chains.delete(chat);
      }
    });

    return task;
  }

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------

  /**
   * Send a plain-text message to a chat (Tier 1 / Tier 2 API).
   */
  send(
    chat: ChatGuid,
    text: string,
    options?: SendOptions
  ): Promise<SendReceipt> {
    return this._enqueue(chat, () => this._doSend(chat, text, options));
  }

  private async _doSend(
    chat: ChatGuid,
    text: string,
    options?: SendOptions
  ): Promise<SendReceipt> {
    const reply = resolveReplyTo(options?.replyTo);

    const request: SendRequest = {
      chatGuid: chat,
      message: text,
      clientMessageId: options?.clientMessageId,
      subject: options?.subject,
      effectId: options?.effect,
      ddScan: options?.ddScan ?? false,
      richLink: options?.richLink ?? false,
      attachmentGuid: options?.attachment as string | undefined,
      isAudioMessage: options?.audioMessage ?? false,
      isSticker: Boolean(options?.sticker),
      stickerPlacement: options?.sticker?.placement
        ? ({
            x: options.sticker.placement.x,
            y: options.sticker.placement.y,
            scale: options.sticker.placement.scale,
            rotation: options.sticker.placement.rotation,
            width: options.sticker.placement.width,
          } satisfies ProtoStickerPlacement)
        : undefined,
      selectedMessageGuid:
        reply?.selectedMessageGuid ??
        (options?.sticker?.target as string | undefined),
      partIndex: reply?.partIndex ?? 0,
      parts: [],
      formatting: toProtoFormatting(options?.formatting),
    };

    try {
      const response = await this._client.send(request);
      const receipt = unwrap(response.receipt, "receipt");
      return {
        guid: messageGuid(receipt.guid),
        clientMessageId: receipt.clientMessageId,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Send a multi-part message (Tier 2.5 API).
   *
   * Like `send()` but accepts an array of `MessagePart` objects instead of
   * a single text string. Formatting is specified per-part rather than at
   * the top level.
   */
  sendMultipart(
    chat: ChatGuid,
    parts: MessagePart[],
    options?: Omit<SendOptions, "formatting">
  ): Promise<SendReceipt> {
    return this._enqueue(chat, () =>
      this._doSendMultipart(chat, parts, options)
    );
  }

  private async _doSendMultipart(
    chat: ChatGuid,
    parts: MessagePart[],
    options?: Omit<SendOptions, "formatting">
  ): Promise<SendReceipt> {
    const reply = resolveReplyTo(options?.replyTo);

    const request: SendRequest = {
      chatGuid: chat,
      clientMessageId: options?.clientMessageId,
      subject: options?.subject,
      effectId: options?.effect,
      ddScan: options?.ddScan ?? false,
      richLink: options?.richLink ?? false,
      attachmentGuid: options?.attachment as string | undefined,
      isAudioMessage: options?.audioMessage ?? false,
      isSticker: Boolean(options?.sticker),
      stickerPlacement: options?.sticker?.placement
        ? ({
            x: options.sticker.placement.x,
            y: options.sticker.placement.y,
            scale: options.sticker.placement.scale,
            rotation: options.sticker.placement.rotation,
            width: options.sticker.placement.width,
          } satisfies ProtoStickerPlacement)
        : undefined,
      selectedMessageGuid:
        reply?.selectedMessageGuid ??
        (options?.sticker?.target as string | undefined),
      partIndex: reply?.partIndex ?? 0,
      parts: toProtoMessageParts(parts),
      formatting: [],
    };

    try {
      const response = await this._client.send(request);
      const receipt = unwrap(response.receipt, "receipt");
      return {
        guid: messageGuid(receipt.guid),
        clientMessageId: receipt.clientMessageId,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Send a fully composed message (Tier 3 API).
   *
   * Accepts a `ComposedMessage` typically produced by `MessageBuilder`.
   */
  sendComposed(chat: ChatGuid, message: ComposedMessage): Promise<SendReceipt> {
    return this._enqueue(chat, () => this._doSendComposed(chat, message));
  }

  private async _doSendComposed(
    chat: ChatGuid,
    message: ComposedMessage
  ): Promise<SendReceipt> {
    const reply = resolveReplyTo(message.replyTo);

    const request: SendRequest = {
      chatGuid: chat,
      subject: message.subject,
      effectId: message.effect,
      ddScan: false,
      richLink: false,
      isAudioMessage: false,
      isSticker: false,
      selectedMessageGuid: reply?.selectedMessageGuid,
      partIndex: reply?.partIndex ?? 0,
      parts: toProtoMessageParts(message.parts),
      formatting: [],
    };

    try {
      const response = await this._client.send(request);
      const receipt = unwrap(response.receipt, "receipt");
      return {
        guid: messageGuid(receipt.guid),
        clientMessageId: receipt.clientMessageId,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------

  /**
   * Send a tapback reaction to a message.
   */
  async react(
    chat: ChatGuid,
    message: MessageGuid,
    reaction: Reaction,
    options?: { partIndex?: number }
  ): Promise<CommandReceipt> {
    try {
      const response = await this._client.sendReaction({
        chatGuid: chat,
        messageGuid: message,
        reaction,
        partIndex: options?.partIndex ?? 0,
      });
      return { guid: messageGuid(unwrap(response.receipt, "receipt").guid) };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Send an emoji reaction to a message (iOS 17+).
   */
  async reactEmoji(
    chat: ChatGuid,
    message: MessageGuid,
    emoji: string,
    options?: { partIndex?: number }
  ): Promise<CommandReceipt> {
    try {
      const response = await this._client.sendReaction({
        chatGuid: chat,
        messageGuid: message,
        reaction: "emoji",
        partIndex: options?.partIndex ?? 0,
        emoji,
      });
      return { guid: messageGuid(unwrap(response.receipt, "receipt").guid) };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Remove a previously sent tapback reaction.
   *
   * The server uses a `-` prefix convention to indicate removal.
   */
  async unreact(
    chat: ChatGuid,
    message: MessageGuid,
    reaction: Reaction,
    options?: { partIndex?: number }
  ): Promise<CommandReceipt> {
    try {
      const response = await this._client.sendReaction({
        chatGuid: chat,
        messageGuid: message,
        reaction: `-${reaction}`,
        partIndex: options?.partIndex ?? 0,
      });
      return { guid: messageGuid(unwrap(response.receipt, "receipt").guid) };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Edit / Unsend
  // -------------------------------------------------------------------------

  /**
   * Edit the text of a previously sent message.
   */
  async edit(
    chat: ChatGuid,
    message: MessageGuid,
    newText: string,
    options?: { backwardCompatText?: string; partIndex?: number }
  ): Promise<void> {
    try {
      await this._client.editMessage({
        chatGuid: chat,
        messageGuid: message,
        newText,
        backwardCompatText: options?.backwardCompatText,
        partIndex: options?.partIndex ?? 0,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Unsend (retract) a previously sent message.
   */
  async unsend(
    chat: ChatGuid,
    message: MessageGuid,
    options?: { partIndex?: number }
  ): Promise<void> {
    try {
      await this._client.unsendMessage({
        chatGuid: chat,
        messageGuid: message,
        partIndex: options?.partIndex ?? 0,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /**
   * Retrieve a single message by GUID.
   */
  async get(guid: MessageGuid): Promise<Message> {
    try {
      const response = await this._client.getMessage({ guid });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * List messages with Stripe-style auto-pagination.
   *
   * Returns a `Paginated<Message>` that is both `await`able (first page) and
   * `for await`able (all items across pages).
   */
  list(options?: MessageListOptions): Paginated<Message> {
    return createPaginated(
      async (offset, limit) => {
        try {
          const response = await this._client.listMessages({
            chatGuid: options?.chatGuid as string | undefined,
            before: options?.before,
            after: options?.after,
            sort: options?.sort
              ? mapSortDirection(options.sort)
              : ProtoSortDirection.SORT_DIRECTION_UNSPECIFIED,
            limit,
            offset,
            withChats: options?.withChats ?? false,
            withAttachments: options?.withAttachments ?? false,
          });

          const meta = response.meta ?? { total: 0, offset: 0, limit };

          return {
            data: response.messages.map(mapMessage),
            meta: {
              total: meta.total,
              offset: meta.offset,
              limit: meta.limit,
            },
          };
        } catch (err) {
          throw fromGrpcError(err);
        }
      },
      { limit: options?.limit, offset: options?.offset }
    );
  }

  /**
   * Get aggregate message statistics (total, sent, received).
   */
  async stats(): Promise<MessageStats> {
    try {
      const response = await this._client.getMessageStats({});
      return {
        total: response.total,
        sent: response.sent,
        received: response.received,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Miscellaneous
  // -------------------------------------------------------------------------

  /**
   * Notify the sender that their silenced message has been seen.
   */
  async notifySilenced(chat: ChatGuid, message: MessageGuid): Promise<void> {
    try {
      await this._client.notifySilenced({
        chatGuid: chat,
        messageGuid: message,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Extract embedded media items from a rich message (e.g. link preview
   * images).
   */
  async getEmbeddedMedia(
    chat: ChatGuid,
    message: MessageGuid
  ): Promise<EmbeddedMediaItem[]> {
    try {
      const response = await this._client.getEmbeddedMedia({
        chatGuid: chat,
        messageGuid: message,
      });
      return response.items.map((item) => ({
        data: item.data,
        mimeType: item.mimeType,
      }));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribe to all message events.
   */
  subscribe(): TypedEventStream<MessageEvent>;
  /**
   * Subscribe to a specific type of message event. The returned stream is
   * narrowed to only that event type.
   */
  subscribe<T extends MessageEvent["type"]>(
    type: T
  ): TypedEventStream<Extract<MessageEvent, { type: T }>>;
  subscribe(type?: MessageEvent["type"]): TypedEventStream<MessageEvent> {
    const rpcStream = this._client.subscribeMessageEvents({});

    async function* mapEvents(): AsyncGenerator<MessageEvent> {
      try {
        for await (const proto of rpcStream) {
          const timestamp = proto.timestamp ?? new Date();

          if (proto.messageSent !== undefined) {
            const evt: MessageSentEvent = proto.messageSent;
            yield {
              type: "message.sent" as const,
              timestamp,
              message: mapMessage(unwrap(evt.message, "message")),
              clientMessageId: evt.clientMessageId,
              chatGuid: chatGuid(evt.chatGuid),
            };
          } else if (proto.messageReceived !== undefined) {
            const evt: MessageReceivedEvent = proto.messageReceived;
            yield {
              type: "message.received" as const,
              timestamp,
              message: mapMessage(unwrap(evt.message, "message")),
              chatGuid: chatGuid(evt.chatGuid),
            };
          } else if (proto.messageUpdated !== undefined) {
            const evt: MessageUpdatedEvent = proto.messageUpdated;
            yield {
              type: "message.updated" as const,
              timestamp,
              message: mapMessage(unwrap(evt.message, "message")),
              updateType: evt.updateType as
                | "edited"
                | "unsent"
                | "notified"
                | "reaction",
              chatGuid: chatGuid(evt.chatGuid),
            };
          } else if (proto.messageSendError !== undefined) {
            const evt: MessageSendErrorEvent = proto.messageSendError;
            yield {
              type: "message.sendError" as const,
              timestamp,
              chatGuid: chatGuid(evt.chatGuid),
              clientMessageId: evt.clientMessageId,
              errorCode: evt.errorCode,
              errorMessage: evt.errorMessage,
            };
          }
          // Unknown payload kinds are silently skipped.
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    const stream = new TypedEventStream<MessageEvent>(mapEvents());

    if (type) {
      return stream.filter(
        (e): e is Extract<MessageEvent, { type: typeof type }> =>
          e.type === type
      );
    }

    return stream;
  }
}
