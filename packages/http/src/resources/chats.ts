import { ChatServiceType as ProtoChatServiceType } from "@photon-ai/aim-core/generated/photon/imessage/v1/address_types";
import type {
  Chat,
  ChatServiceClient,
  CreateChatOptions,
  CreateChatResult,
} from "@photon-ai/aim-core/internal";
import {
  mapChat,
  mapMessage,
  normalizeChatGuid,
  toIMessageError,
  unwrap,
  ValidationError,
} from "@photon-ai/aim-core/internal";

function normalizeInitialMessageText(
  message: string | undefined
): string | undefined {
  if (message === undefined) {
    return undefined;
  }

  if (typeof message !== "string") {
    throw new ValidationError("message must be a string.", {
      code: "invalidArgument",
      context: { field: "message", value: String(message) },
      grpcCode: 3,
      retryable: false,
    });
  }

  return message;
}

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
      const message = normalizeInitialMessageText(options?.message);

      const response = await this._client.createChat({
        addresses,
        clientMessageId: options?.clientMessageId,
        service: ProtoChatServiceType.CHAT_SERVICE_TYPE_IMESSAGE,
        initialMessage:
          message === undefined
            ? undefined
            : {
                attributedBody: options?.attributedBody,
                text: message,
                effectId: options?.effect,
                subject: options?.subject,
              },
      });

      return {
        chat: mapChat(unwrap(response.chat, "chat")),
        initialMessage: response.initialMessage
          ? mapMessage(response.initialMessage)
          : undefined,
      };
    } catch (err) {
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
    }
  }
}
