import { fromGrpcError } from "../errors/error-handler.ts";
import { ChatServiceType as ProtoChatServiceType } from "../generated/photon/imessage/v1/address_types.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { ChatServiceClient } from "../transport/grpc-client.ts";
import { mapChat, mapChatEvent, mapMessage } from "../transport/mapper.ts";
import { normalizeChatGuid } from "../types/chat-guid.ts";
import type {
  Chat,
  CreateChatOptions,
  CreateChatResult,
} from "../types/chats.ts";
import type { ChatEvent } from "../types/events.ts";
import { unwrap } from "../utils/unwrap.ts";

/**
 * Chat APIs.
 *
 * - `create(addresses, options)` creates a direct or group chat; can send an
 *   opening text message in the same server call.
 * - `get(chat)` fetches one chat by its `any;-;...` or `any;+;...` guid.
 * - `count(options)` returns the number of visible chats, optionally including
 *   archived chats.
 * - `hasBackground(chat)` checks whether a chat has a custom background.
 * - `setBackground(chat, data)` replaces the chat background image.
 * - `removeBackground(chat)` clears the chat background image.
 * - `markRead(chat)` marks every unread message in the chat as read.
 * - `shareContactInfo(chat)` sends the local user's contact card to the chat.
 * - `setTyping(chat, isTyping)` starts or stops the transient typing indicator.
 * - `subscribeEvents(filter)` streams chat archive, background, and read-state
 *   changes; use `events.catchUp(since)` for disconnect recovery.
 */
export class ChatsResource {
  private readonly _client: ChatServiceClient;

  constructor(client: ChatServiceClient) {
    this._client = client;
  }

  /**
   * Create a chat with one or more peers, optionally sending an opening
   * message in the same round-trip.
   *
   * Pass `options.message` to send the initial message in the same request.
   *
   * @param addresses - One or more peer addresses (email or phone). One
   *                    address creates a 1:1 chat; two or more create a
   *                    group.
   */
  async create(
    addresses: string[],
    options?: CreateChatOptions
  ): Promise<CreateChatResult> {
    try {
      const response = await this._client.createChat({
        addresses,
        clientMessageId: options?.clientMessageId,
        service: ProtoChatServiceType.CHAT_SERVICE_TYPE_IMESSAGE,
        initialMessage:
          options?.message === undefined
            ? undefined
            : {
                attributedBody: options.attributedBody,
                text: options.message,
                effectId: options.effect,
                subject: options.subject,
              },
      });

      return {
        chat: mapChat(unwrap(response.chat, "chat")),
        initialMessage: response.initialMessage
          ? mapMessage(response.initialMessage)
          : undefined,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Fetch a chat by reference.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid` from a previous SDK call.
   */
  async get(chat: string): Promise<Chat> {
    try {
      const response = await this._client.getChat({
        chatGuid: normalizeChatGuid(chat),
      });
      return mapChat(unwrap(response.chat, "chat"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /** Count chats accessible to the current account. */
  async count(options?: { includeArchived?: boolean }): Promise<number> {
    try {
      const response = await this._client.getChatCount({
        includeArchived: options?.includeArchived ?? false,
      });
      return response.count;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Whether `chat` has a custom background set.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async hasBackground(chat: string): Promise<boolean> {
    try {
      const response = await this._client.hasBackground({
        chatGuid: normalizeChatGuid(chat),
      });
      return response.backgroundPresent;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Replace `chat`'s background with the supplied image bytes.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async setBackground(chat: string, data: Uint8Array): Promise<void> {
    try {
      await this._client.setBackground({
        chatGuid: normalizeChatGuid(chat),
        data,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Clear `chat`'s custom background.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async removeBackground(chat: string): Promise<void> {
    try {
      await this._client.removeBackground({
        chatGuid: normalizeChatGuid(chat),
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Mark every unread message in `chat` as read.
   *
   * Resolves once the server has accepted and executed the command.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async markRead(chat: string): Promise<void> {
    try {
      await this._client.markChatRead({ chatGuid: normalizeChatGuid(chat) });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Send your contact card to `chat`.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async shareContactInfo(chat: string): Promise<void> {
    try {
      await this._client.shareContactInfo({
        chatGuid: normalizeChatGuid(chat),
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Set the transient typing indicator in `chat`.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   */
  async setTyping(chat: string, isTyping: boolean): Promise<void> {
    try {
      await this._client.setTyping({
        chatGuid: normalizeChatGuid(chat),
        isTyping,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Subscribe to chat-level durable change events (background changed,
   * marked-read, archive state).
   *
   * Pass `filter.chat` to scope the stream to a single chat.
   */
  subscribeEvents(filter?: { chat?: string }): TypedEventStream<ChatEvent> {
    const abort = new AbortController();
    const rpcStream = this._client.subscribeChatEvents(
      {
        chatGuid: filter?.chat ? normalizeChatGuid(filter.chat) : undefined,
      },
      { signal: abort.signal }
    );

    async function* mapEvents(): AsyncGenerator<ChatEvent> {
      try {
        for await (const frame of rpcStream) {
          if (frame.sequence === undefined || !frame.chatChanged) {
            continue;
          }
          const event = mapChatEvent(frame.sequence, frame.chatChanged);
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
