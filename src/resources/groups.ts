import { fromGrpcError } from "../errors/error-handler.ts";
import { ValidationError } from "../errors/imessage-error.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { GroupServiceClient } from "../transport/grpc-client.ts";
import { mapChat, mapGroupEvent } from "../transport/mapper.ts";
import { normalizeChatGuid } from "../types/chat-guid.ts";
import type { Chat } from "../types/chats.ts";
import type { IdempotencyOptions } from "../types/common.ts";
import type { GroupEvent } from "../types/events.ts";
import { unwrap } from "../utils/unwrap.ts";

export interface GroupIcon {
  readonly data: Uint8Array;
  readonly mimeType: string;
}

function normalizeDisplayName(displayName: string): string {
  if (typeof displayName !== "string") {
    throw new ValidationError("display_name must be a string.", {
      code: "invalidArgument",
      context: { field: "display_name", value: String(displayName) },
      grpcCode: 3,
      retryable: false,
    });
  }

  const normalized = displayName.trim();

  if (!normalized) {
    throw new ValidationError("display_name must not be empty", {
      code: "invalidArgument",
      context: { field: "display_name" },
      grpcCode: 3,
      retryable: false,
    });
  }

  return normalized;
}

function normalizeParticipantAddresses(addresses: string[]): string[] {
  if (!Array.isArray(addresses)) {
    throw new ValidationError("addresses must be an array.", {
      code: "invalidArgument",
      context: { field: "addresses", value: String(addresses) },
      grpcCode: 3,
      retryable: false,
    });
  }

  if (addresses.length === 0) {
    throw new ValidationError("addresses must not be empty", {
      code: "invalidArgument",
      context: { field: "addresses" },
      grpcCode: 3,
      retryable: false,
    });
  }

  return Array.from(addresses, (address, index) => {
    if (typeof address !== "string") {
      throw new ValidationError(`addresses[${index}] must be a string.`, {
        code: "invalidArgument",
        context: { field: `addresses[${index}]`, value: String(address) },
        grpcCode: 3,
        retryable: false,
      });
    }

    const normalized = address.trim();

    if (!normalized) {
      throw new ValidationError(`addresses[${index}] must not be empty`, {
        code: "invalidArgument",
        context: { field: `addresses[${index}]` },
        grpcCode: 3,
        retryable: false,
      });
    }

    return normalized;
  });
}

function normalizeIconData(data: Uint8Array): Uint8Array {
  if (!(data instanceof Uint8Array)) {
    throw new ValidationError("data must be a Uint8Array.", {
      code: "invalidArgument",
      context: { field: "data", value: String(data) },
      grpcCode: 3,
      retryable: false,
    });
  }

  return data;
}

/**
 * Group APIs.
 *
 * - `setDisplayName(chat, displayName, options)` renames a group chat.
 * - `addParticipants(chat, addresses, options)` invites one or more addresses
 *   into a group chat.
 * - `removeParticipants(chat, addresses, options)` removes one or more
 *   addresses from a group chat.
 * - `leave(chat, options)` makes the local account leave the group chat.
 * - `setIcon(chat, data, options)` replaces the group photo with image bytes.
 * - `getIcon(chat)` downloads the current group photo bytes and MIME type.
 * - `removeIcon(chat, options)` clears the group photo.
 * - `subscribeEvents(filter)` streams group name, membership, and icon changes;
 *   use `events.catchUp(since)` for disconnect recovery.
 */
export class GroupsResource {
  private readonly _client: GroupServiceClient;

  constructor(client: GroupServiceClient) {
    this._client = client;
  }

  /**
   * Rename a group chat.
   *
   * @param chat - An `any;+;...` group chat guid. In practice, pass
   *               `chat.guid` from a prior SDK call.
   *               Direct chats reject this operation server-side.
   */
  async setDisplayName(
    chat: string,
    displayName: string,
    options?: IdempotencyOptions
  ): Promise<Chat> {
    try {
      const response = await this._client.setDisplayName({
        chatGuid: normalizeChatGuid(chat),
        displayName: normalizeDisplayName(displayName),
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Add one or more participants to a group chat.
   *
   * @param chat - An `any;+;...` group chat guid. In practice, pass
   *               `chat.guid`.
   * @param addresses - Email addresses or phone numbers to invite.
   */
  async addParticipants(
    chat: string,
    addresses: string[],
    options?: IdempotencyOptions
  ): Promise<Chat> {
    try {
      const response = await this._client.addParticipants({
        chatGuid: normalizeChatGuid(chat),
        addresses: normalizeParticipantAddresses(addresses),
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Remove participants from a group chat (only the chat creator can do this).
   *
   * @param chat - An `any;+;...` group chat guid. In practice, pass
   *               `chat.guid`.
   * @param addresses - Email addresses or phone numbers to remove.
   */
  async removeParticipants(
    chat: string,
    addresses: string[],
    options?: IdempotencyOptions
  ): Promise<Chat> {
    try {
      const response = await this._client.removeParticipants({
        chatGuid: normalizeChatGuid(chat),
        addresses: normalizeParticipantAddresses(addresses),
        clientMessageId: options?.clientMessageId,
      });
      return mapChat(unwrap(response.chat, "chat"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Leave a group chat.
   *
   * @param chat - An `any;+;...` group chat guid. In practice, pass
   *               `chat.guid`.
   */
  async leave(chat: string, options?: IdempotencyOptions): Promise<void> {
    try {
      await this._client.leaveGroup({
        chatGuid: normalizeChatGuid(chat),
        clientMessageId: options?.clientMessageId,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Set the group photo to the supplied image bytes.
   *
   * @param chat - An `any;+;...` group chat guid. In practice, pass
   *               `chat.guid`.
   */
  async setIcon(
    chat: string,
    data: Uint8Array,
    options?: IdempotencyOptions
  ): Promise<void> {
    try {
      await this._client.setIcon({
        chatGuid: normalizeChatGuid(chat),
        data: normalizeIconData(data),
        clientMessageId: options?.clientMessageId,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Fetch the current group photo bytes.
   *
   * @param chat - An `any;+;...` group chat guid. In practice, pass
   *               `chat.guid`.
   */
  async getIcon(chat: string): Promise<GroupIcon> {
    try {
      const response = await this._client.getIcon({
        chatGuid: normalizeChatGuid(chat),
      });
      return {
        data: response.data,
        mimeType: response.mimeType,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Clear the group photo.
   *
   * @param chat - An `any;+;...` group chat guid. In practice, pass
   *               `chat.guid`.
   */
  async removeIcon(chat: string, options?: IdempotencyOptions): Promise<void> {
    try {
      await this._client.removeIcon({
        chatGuid: normalizeChatGuid(chat),
        clientMessageId: options?.clientMessageId,
      });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Subscribe to group-membership / metadata events.
   *
   * Pass `filter.chat` to scope the stream to a single group.
   */
  subscribeEvents(filter?: { chat?: string }): TypedEventStream<GroupEvent> {
    const abort = new AbortController();
    const rpcStream = this._client.subscribeGroupEvents(
      {
        chatGuid: filter?.chat ? normalizeChatGuid(filter.chat) : undefined,
      },
      { signal: abort.signal }
    );

    async function* mapEvents(): AsyncGenerator<GroupEvent> {
      try {
        for await (const frame of rpcStream) {
          if (
            frame.sequence === undefined ||
            frame.payload.case !== "groupChanged"
          ) {
            continue;
          }
          const event = mapGroupEvent(
            Number(frame.sequence),
            frame.payload.value
          );
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
