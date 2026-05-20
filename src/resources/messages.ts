import { fromGrpcError } from "../errors/error-handler.ts";
import { MessageReactionKind } from "../generated/photon/imessage/v1/message_types.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { MessageServiceClient } from "../transport/grpc-client.ts";
import {
  mapEmbeddedMedia,
  mapMessage,
  mapMessageEvent,
  mapOutgoingMessagePart,
  mapReplyTarget,
  mapTextFormatInput,
} from "../transport/mapper.ts";
import type {
  AttachmentInput,
  UploadAttachmentResult,
} from "../types/attachments.ts";
import { normalizeChatGuid } from "../types/chat-guid.ts";
import type { MessageEffect } from "../types/effects.ts";
import type { MessageEvent } from "../types/events.ts";
import type {
  EmbeddedMedia,
  Message,
  MessageListFilter,
  MessageListPage,
  MessagePart,
  SendOptions,
  SettableMessageReaction,
  StickerPlacement,
} from "../types/messages.ts";
import { unwrap } from "../utils/unwrap.ts";

// Wire enum is the single source of truth for ordinal values; routing through
// the named constant keeps reorderings in proto from silently misaligning.
function toReactionKind(
  reaction: SettableMessageReaction["kind"]
): MessageReactionKind {
  switch (reaction) {
    case "love":
      return MessageReactionKind.MESSAGE_REACTION_KIND_LOVE;
    case "like":
      return MessageReactionKind.MESSAGE_REACTION_KIND_LIKE;
    case "dislike":
      return MessageReactionKind.MESSAGE_REACTION_KIND_DISLIKE;
    case "laugh":
      return MessageReactionKind.MESSAGE_REACTION_KIND_LAUGH;
    case "emphasize":
      return MessageReactionKind.MESSAGE_REACTION_KIND_EMPHASIZE;
    case "question":
      return MessageReactionKind.MESSAGE_REACTION_KIND_QUESTION;
    case "emoji":
      return MessageReactionKind.MESSAGE_REACTION_KIND_EMOJI;
    default:
      throw new TypeError(`Unsupported reaction kind: ${String(reaction)}`);
  }
}

function hasByteBackedAttachment(part: MessagePart): part is MessagePart & {
  readonly attachment: NonNullable<MessagePart["attachment"]>;
} {
  return part.attachment !== undefined;
}

interface MessagesResourceDependencies {
  readonly uploadAttachment?: (
    input: AttachmentInput
  ) => Promise<UploadAttachmentResult>;
}

/**
 * Message APIs.
 *
 * - `sendText(chat, text, options)` sends a text message; supports replies,
 *   subjects, effects, rich links, data-detector scanning, text formatting,
 *   and `clientMessageId`.
 * - `sendAttachment(chat, attachment, options)` sends an uploaded attachment
 *   by attachment GUID; supports replies, effects, audio-message mode, and
 *   `clientMessageId`.
 * - `sendMultipart(chat, parts, options)` sends multiple bubbles atomically;
 *   parts can contain text, uploaded attachment GUIDs, byte-backed
 *   attachments, mentions, formatting, and bubble indexes.
 * - `edit(chat, message, newText, options)` edits an existing message and can
 *   target a specific multipart bubble with `partIndex`.
 * - `unsend(chat, message, options)` retracts an existing message and can
 *   target a specific multipart bubble with `partIndex`.
 * - `setReaction(chat, message, reaction, isSet, options)` adds or removes a
 *   tapback / emoji reaction.
 * - `placeSticker(chat, message, sticker, placement, options)` places an
 *   uploaded sticker attachment on a message.
 * - `notifySilenced(chat, message, options)` triggers Apple's Notify Anyway
 *   action for a Focus-silenced conversation.
 * - `get(chat, message)` fetches one message inside a known chat.
 * - `listRecent(filter)` pages through recent messages across chats.
 * - `listInChat(chat, filter)` pages through messages in one chat.
 * - `getEmbeddedMedia(chat, message)` downloads Digital Touch / handwritten
 *   embedded media bytes.
 * - `subscribeEvents(filter)` streams live message events; use
 *   `events.catchUp(since)` for disconnect recovery.
 */
export class MessagesResource {
  private readonly _client: MessageServiceClient;
  private readonly _uploadAttachment:
    | ((input: AttachmentInput) => Promise<UploadAttachmentResult>)
    | undefined;

  constructor(
    client: MessageServiceClient,
    dependencies?: MessagesResourceDependencies
  ) {
    this._client = client;
    this._uploadAttachment = dependencies?.uploadAttachment;
  }

  private async normalizeMultipartParts(
    parts: readonly MessagePart[]
  ): Promise<readonly MessagePart[]> {
    if (!parts.some(hasByteBackedAttachment)) {
      return parts;
    }

    if (!this._uploadAttachment) {
      throw new Error(
        "messages.sendMultipart received a byte-backed attachment part without upload support"
      );
    }

    const normalizedParts: MessagePart[] = [];
    for (const part of parts) {
      if (!hasByteBackedAttachment(part) || part.attachmentGuid) {
        normalizedParts.push(part);
        continue;
      }

      const uploadResult = await this._uploadAttachment(part.attachment);
      const { attachment, attachmentName, ...rest } = part;
      normalizedParts.push({
        ...rest,
        attachmentGuid: uploadResult.attachment.guid,
        attachmentName: attachmentName ?? attachment.fileName,
      });
    }

    return normalizedParts;
  }

  /**
   * Send a plain-text message.
   *
   * The returned `Message` is the server's immediate snapshot.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param text - The message body.
   */
  async sendText(
    chat: string,
    text: string,
    options?: SendOptions
  ): Promise<Message> {
    try {
      const response = await this._client.sendTextMessage({
        chatGuid: normalizeChatGuid(chat),
        text,
        replyTo: mapReplyTarget(options?.replyTo),
        subject: options?.subject,
        effectId: options?.effect,
        enableDataDetection: options?.enableDataDetection,
        enableLinkPreview: options?.enableLinkPreview,
        formatting: (options?.formatting ?? []).map(mapTextFormatInput),
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Send a previously uploaded attachment as a message.
   *
   * The returned `Message` is the server's immediate snapshot.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param attachment - Attachment guid returned by `attachments.upload(...)`.
   */
  async sendAttachment(
    chat: string,
    attachment: string,
    options?: {
      readonly clientMessageId?: string;
      readonly effect?: MessageEffect;
      readonly isAudioMessage?: boolean;
      readonly replyTo?: SendOptions["replyTo"];
    }
  ): Promise<Message> {
    try {
      const response = await this._client.sendAttachmentMessage({
        chatGuid: normalizeChatGuid(chat),
        attachment: { attachmentGuid: attachment },
        replyTo: mapReplyTarget(options?.replyTo),
        effectId: options?.effect,
        isAudioMessage: options?.isAudioMessage,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Send a multi-part message (interleaved text, attachments, mentions).
   *
   * The returned `Message` is the server's immediate snapshot.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async sendMultipart(
    chat: string,
    parts: readonly MessagePart[],
    options?: {
      readonly clientMessageId?: string;
      readonly enableDataDetection?: boolean;
      readonly effect?: MessageEffect;
      readonly replyTo?: SendOptions["replyTo"];
      readonly subject?: string;
    }
  ): Promise<Message> {
    try {
      const normalizedParts = await this.normalizeMultipartParts(parts);
      const response = await this._client.sendMultipartMessage({
        chatGuid: normalizeChatGuid(chat),
        parts: normalizedParts.map(mapOutgoingMessagePart),
        replyTo: mapReplyTarget(options?.replyTo),
        subject: options?.subject,
        effectId: options?.effect,
        enableDataDetection: options?.enableDataDetection,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Edit an already-sent message (within Apple's 15-minute edit window).
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param message - Guid of the message to edit (`message.guid`).
   * @param options.backwardCompatText - Server-defined plain-text edit body
   *   used when rich edit rendering is unavailable.
   */
  async edit(
    chat: string,
    message: string,
    newText: string,
    options?: {
      readonly backwardCompatText?: string;
      readonly clientMessageId?: string;
      readonly partIndex?: number;
    }
  ): Promise<Message> {
    try {
      const response = await this._client.editMessage({
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        newText,
        backwardCompatText: options?.backwardCompatText,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Retract (un-send) a message, within Apple's 2-minute window.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param message - Guid of the message to retract (`message.guid`).
   */
  async unsend(
    chat: string,
    message: string,
    options?: { readonly clientMessageId?: string; readonly partIndex?: number }
  ): Promise<void> {
    try {
      await this._client.unsendMessage({
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        clientMessageId: options?.clientMessageId,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Add or remove a tapback reaction on a message.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param message - Guid of the target message (`message.guid`).
   */
  async setReaction(
    chat: string,
    message: string,
    reaction: SettableMessageReaction,
    isSet: boolean,
    options?: { readonly clientMessageId?: string; readonly partIndex?: number }
  ): Promise<Message> {
    const kind = toReactionKind(reaction.kind);

    try {
      const response = await this._client.setReaction({
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        reaction: {
          kind,
          emoji: reaction.emoji,
        },
        isSet,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Place a sticker on a message.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param message - Guid of the target message.
   * @param sticker - Attachment guid of an uploaded sticker image.
   */
  async placeSticker(
    chat: string,
    message: string,
    sticker: string,
    placement: StickerPlacement,
    options?: { readonly clientMessageId?: string; readonly partIndex?: number }
  ): Promise<Message> {
    try {
      const response = await this._client.placeSticker({
        target: {
          chatGuid: normalizeChatGuid(chat),
          messageGuid: message,
          targetPartIndex: options?.partIndex,
        },
        sticker: { attachmentGuid: sticker },
        placement,
        clientMessageId: options?.clientMessageId,
      });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Tell the recipient that a notify-silenced (Focus / Do Not Disturb) bypass
   * was attempted for `message`.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param message - Guid of the message that triggered the silence.
   */
  async notifySilenced(
    chat: string,
    message: string,
    options?: { readonly clientMessageId?: string }
  ): Promise<void> {
    try {
      await this._client.notifySilencedMessage({
        chatGuid: normalizeChatGuid(chat),
        messageGuid: message,
        clientMessageId: options?.clientMessageId,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Fetch a single message by its guid within a known chat.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param message - Guid of the message to fetch (`message.guid`).
   */
  async get(chat: string, message: string): Promise<Message> {
    try {
      const response = await this._client.getMessage({
        chatGuid: normalizeChatGuid(chat),
        messageGuid: message,
      });
      return mapMessage(unwrap(response.message, "message"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * List recent messages across all chats.
   *
   * `options.pageSize`, when provided, must be between `1` and `100`
   * inclusive.
   */
  async listRecent(options?: MessageListFilter): Promise<MessageListPage> {
    try {
      const response = await this._client.listRecentMessages({
        pageSize: options?.pageSize,
        pageToken: options?.pageToken,
        isFromMe: options?.isFromMe,
        isRead: options?.isRead,
        before: options?.before,
        after: options?.after,
      });
      return {
        messages: response.messages.map(mapMessage),
        nextPageToken: response.nextPageToken,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * List recent messages within a single chat.
   *
   * `options.pageSize`, when provided, must be between `1` and `100`
   * inclusive.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async listInChat(
    chat: string,
    options?: MessageListFilter
  ): Promise<MessageListPage> {
    try {
      const response = await this._client.listChatMessages({
        chatGuid: normalizeChatGuid(chat),
        pageSize: options?.pageSize,
        pageToken: options?.pageToken,
        isFromMe: options?.isFromMe,
        isRead: options?.isRead,
        before: options?.before,
        after: options?.after,
      });
      return {
        messages: response.messages.map(mapMessage),
        nextPageToken: response.nextPageToken,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Fetch embedded media bytes for a supported Digital Touch or handwritten
   * message.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param message - Guid of the bubble whose media you want.
   */
  async getEmbeddedMedia(
    chat: string,
    message: string
  ): Promise<EmbeddedMedia> {
    try {
      const response = await this._client.getEmbeddedMedia({
        chatGuid: normalizeChatGuid(chat),
        messageGuid: message,
      });
      return mapEmbeddedMedia(unwrap(response.media, "media"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Subscribe to message-level events (received / edited / read / unsent /
   * reaction / sticker).
   *
   * Use the write response as the authoritative result for the mutation you
   * just issued.
   *
   * Pass `filter.chat` to scope the stream to a single chat.
   */
  subscribeEvents(filter?: { chat?: string }): TypedEventStream<MessageEvent> {
    const abort = new AbortController();
    const rpcStream = this._client.subscribeMessageEvents(
      {
        chatGuid: filter?.chat ? normalizeChatGuid(filter.chat) : undefined,
      },
      { signal: abort.signal }
    );

    async function* mapEvents(): AsyncGenerator<MessageEvent> {
      try {
        for await (const frame of rpcStream) {
          if (frame.sequence === undefined || !frame.messageChanged) {
            continue;
          }
          const event = mapMessageEvent(frame.sequence, frame.messageChanged);
          if (event) {
            yield event;
          }
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream(mapEvents(), async () => abort.abort());
  }
}
