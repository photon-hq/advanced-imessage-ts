/**
 * ChatsResource -- manages conversations (direct and group), including
 * creation, deletion, typing indicators, contact info sharing, participants,
 * and real-time event subscription.
 */

import type { IChatServiceClient } from "../transport/grpc-client.ts";
import {
  mapChat,
  mapAddressInfo,
  mapMessage,
  timestampToDate,
} from "../transport/mapper.ts";
import { fromGrpcError } from "../errors/error-handler.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";

import type { ChatGuid } from "../types/branded.ts";
import { chatGuid } from "../types/branded.ts";
import { messageGuid } from "../types/branded.ts";
import type { SendReceipt } from "../types/common.ts";
import type { Chat, CreateChatOptions } from "../types/chats.ts";
import type { AddressInfo } from "../types/addresses.ts";
import type { ChatEvent } from "../types/events.ts";
import type {
  ChatReadStatusEvent,
  TypingEvent,
} from "../generated/photon/imessage/v1/chat_service.ts";

// ---------------------------------------------------------------------------
// ChatsResource
// ---------------------------------------------------------------------------

export class ChatsResource {
  private readonly _client: IChatServiceClient;

  constructor(client: IChatServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Create a new chat with one or more participants.
   *
   * Returns the created chat and an optional send receipt if an initial
   * message was provided.
   */
  async create(
    addresses: string[],
    options?: CreateChatOptions,
  ): Promise<{ chat: Chat; sendReceipt?: SendReceipt }> {
    try {
      const { response } = await this._client.createChat({
        addresses,
        message: options?.message,
        service: options?.service ?? "iMessage",
        effectId: options?.effectId,
        subject: options?.subject,
        clientMessageId: options?.clientMessageId,
      });

      const chat = mapChat(response.chat!);

      const sendReceipt = response.sendReceipt
        ? {
            guid: messageGuid(response.sendReceipt.guid),
            clientMessageId: response.sendReceipt.clientMessageId,
          }
        : undefined;

      return { chat, sendReceipt };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Retrieve a single chat by GUID.
   */
  async get(guid: ChatGuid): Promise<Chat> {
    try {
      const { response } = await this._client.getChat({ guid });
      return mapChat(response.chat!);
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Get the total number of chats.
   *
   * @param includeArchived - Whether to include archived chats in the count.
   */
  async count(options?: { includeArchived?: boolean }): Promise<number> {
    try {
      const { response } = await this._client.getChatCount({
        includeArchived: options?.includeArchived ?? false,
      });
      return response.count;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Permanently delete a chat.
   */
  async delete(guid: ChatGuid): Promise<void> {
    try {
      await this._client.deleteChat({ guid });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Leave a group chat.
   */
  async leave(guid: ChatGuid): Promise<void> {
    try {
      await this._client.leaveChat({ guid });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Read receipts
  // -------------------------------------------------------------------------

  /**
   * Mark all messages in a chat as read.
   */
  async markRead(chat: ChatGuid): Promise<void> {
    try {
      await this._client.markRead({ chatGuid: chat });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Contact info sharing
  // -------------------------------------------------------------------------

  /**
   * Check whether the local user can share contact info (Name and Photo)
   * with the participants of a chat.
   */
  async canShareContactInfo(chat: ChatGuid): Promise<boolean> {
    try {
      const { response } = await this._client.canShareContactInfo({
        chatGuid: chat,
      });
      return response.canShare;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Share the local user's contact info (Name and Photo) with a chat.
   */
  async shareContactInfo(chat: ChatGuid): Promise<void> {
    try {
      await this._client.shareContactInfo({ chatGuid: chat });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Typing indicators
  // -------------------------------------------------------------------------

  /**
   * Show a typing indicator in a chat.
   */
  async startTyping(chat: ChatGuid): Promise<void> {
    try {
      await this._client.startTyping({ chatGuid: chat });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Remove the typing indicator from a chat.
   */
  async stopTyping(chat: ChatGuid): Promise<void> {
    try {
      await this._client.stopTyping({ chatGuid: chat });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Participants
  // -------------------------------------------------------------------------

  /**
   * Get the list of participants in a chat.
   */
  async getParticipants(chat: ChatGuid): Promise<AddressInfo[]> {
    try {
      const { response } = await this._client.getParticipants({
        chatGuid: chat,
      });
      return response.participants.map(mapAddressInfo);
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  /**
   * Subscribe to all chat events.
   */
  subscribe(): TypedEventStream<ChatEvent>;
  /**
   * Subscribe to a specific type of chat event. The returned stream is
   * narrowed to only that event type.
   */
  subscribe<T extends ChatEvent["type"]>(
    type: T,
  ): TypedEventStream<Extract<ChatEvent, { type: T }>>;
  subscribe(
    type?: ChatEvent["type"],
  ): TypedEventStream<ChatEvent> {
    const rpcCall = this._client.subscribeChatEvents({});

    async function* mapEvents(): AsyncGenerator<ChatEvent> {
      try {
        for await (const proto of rpcCall.responses) {
          const timestamp = proto.timestamp
            ? timestampToDate(proto.timestamp)
            : new Date();

          const { payload } = proto;

          if (payload.oneofKind === "chatReadStatusChanged") {
            const evt = (payload as any).chatReadStatusChanged as ChatReadStatusEvent;
            yield {
              type: "chat.readStatusChanged" as const,
              timestamp,
              chatGuid: chatGuid(evt.chatGuid),
              isRead: evt.isRead,
            };
          } else if (payload.oneofKind === "typingIndicator") {
            const evt = (payload as any).typingIndicator as TypingEvent;
            yield {
              type: "chat.typingIndicator" as const,
              timestamp,
              chatGuid: chatGuid(evt.chatGuid),
              isTyping: evt.isTyping,
              displayName: evt.displayName,
            };
          }
          // Unknown payload kinds are silently skipped.
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    const stream = new TypedEventStream<ChatEvent>(mapEvents());

    if (type) {
      return stream.filter(
        (e): e is Extract<ChatEvent, { type: typeof type }> =>
          e.type === type,
      );
    }

    return stream;
  }
}
