/**
 * GroupsResource -- group chat management operations.
 *
 * Wraps the gRPC GroupService to provide high-level methods for managing
 * group chat properties: display name, participants, icon, and background.
 * Also exposes a `subscribe()` method for streaming group change events.
 */

import { fromGrpcError } from "../errors/error-handler.ts";
import type { GroupChangeEvent } from "../generated/photon/imessage/v1/group_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { GroupServiceClient } from "../transport/grpc-client.ts";
import { mapChat } from "../transport/mapper.ts";
import type { ChatGuid } from "../types/branded.ts";
import { chatGuid } from "../types/branded.ts";
import type { Chat } from "../types/chats.ts";
import type { GroupChange, GroupEvent } from "../types/events.ts";
import type { BackgroundInfo } from "../types/groups.ts";
import { unwrap } from "../utils/unwrap.ts";

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export class GroupsResource {
  private readonly _client: GroupServiceClient;

  constructor(client: GroupServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // Display name
  // -------------------------------------------------------------------------

  /** Rename a group chat. Returns the updated chat. */
  async setDisplayName(chat: ChatGuid, name: string): Promise<Chat> {
    try {
      const response = await this._client.setDisplayName({
        chatGuid: chat,
        name,
      });
      return mapChat(unwrap(response.chat, "chat"));
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Participants
  // -------------------------------------------------------------------------

  /** Add a participant to a group chat by address. Returns the updated chat. */
  async addParticipant(chat: ChatGuid, address: string): Promise<Chat> {
    try {
      const response = await this._client.addParticipant({
        chatGuid: chat,
        address,
      });
      return mapChat(unwrap(response.chat, "chat"));
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Remove a participant from a group chat by address. Returns the updated chat. */
  async removeParticipant(chat: ChatGuid, address: string): Promise<Chat> {
    try {
      const response = await this._client.removeParticipant({
        chatGuid: chat,
        address,
      });
      return mapChat(unwrap(response.chat, "chat"));
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Icon
  // -------------------------------------------------------------------------

  /** Set the group chat icon from raw image bytes. */
  async setIcon(chat: ChatGuid, data: Uint8Array): Promise<void> {
    try {
      await this._client.setIcon({ chatGuid: chat, data });
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Get the group chat icon as raw bytes, or `null` if none is set. */
  async getIcon(chat: ChatGuid): Promise<Uint8Array | null> {
    try {
      const response = await this._client.getIcon({ chatGuid: chat });
      return response.data ?? null;
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Remove the group chat icon. */
  async removeIcon(chat: ChatGuid): Promise<void> {
    try {
      await this._client.removeIcon({ chatGuid: chat });
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Background
  // -------------------------------------------------------------------------

  /** Set the group chat background from raw image bytes. */
  async setBackground(
    chat: ChatGuid,
    data: Uint8Array
  ): Promise<BackgroundInfo> {
    try {
      const response = await this._client.setBackground({
        chatGuid: chat,
        data,
      });
      return {
        channelGuid: response.channelGuid,
        imageUrl: response.imageUrl,
        backgroundId: response.backgroundId,
      };
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Get the group chat background info, or `null` if none is set. */
  async getBackground(chat: ChatGuid): Promise<BackgroundInfo | null> {
    try {
      const response = await this._client.getBackground({ chatGuid: chat });
      // If all fields are absent, consider it as no background.
      if (
        response.channelGuid === undefined &&
        response.imageUrl === undefined &&
        response.backgroundId === undefined
      ) {
        return null;
      }
      return {
        channelGuid: response.channelGuid,
        imageUrl: response.imageUrl,
        backgroundId: response.backgroundId,
      };
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Remove the group chat background. */
  async removeBackground(chat: ChatGuid): Promise<void> {
    try {
      await this._client.removeBackground({ chatGuid: chat });
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  /** Subscribe to group change events. Returns a typed event stream. */
  subscribe(): TypedEventStream<GroupEvent> {
    const rpcStream = this._client.subscribeGroupEvents({});

    async function* mapEvents(): AsyncGenerator<GroupEvent> {
      try {
        for await (const proto of rpcStream) {
          const timestamp = proto.timestamp ?? new Date();

          if (proto.groupChanged === undefined) {
            continue;
          }

          const evt: GroupChangeEvent = proto.groupChanged;
          const change = mapGroupChange(evt);
          if (!change) {
            continue;
          }

          yield {
            type: "group.changed" as const,
            chatGuid: chatGuid(evt.chatGuid),
            timestamp,
            change,
          };
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream<GroupEvent>(mapEvents());
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a proto GroupChangeEvent to the SDK GroupChange discriminated union.
 *
 * ts-proto represents oneof fields as optional properties on the message.
 * We check each field to determine which change occurred.
 */
function mapGroupChange(evt: GroupChangeEvent): GroupChange | undefined {
  if (evt.renamedTo !== undefined) {
    return { type: "renamed", name: evt.renamedTo };
  }
  if (evt.participantAdded !== undefined) {
    return { type: "participantAdded", address: evt.participantAdded };
  }
  if (evt.participantRemoved !== undefined) {
    return { type: "participantRemoved", address: evt.participantRemoved };
  }
  if (evt.iconChanged !== undefined) {
    return { type: "iconChanged" };
  }
  if (evt.iconRemoved !== undefined) {
    return { type: "iconRemoved" };
  }
  if (evt.backgroundChanged !== undefined) {
    return { type: "backgroundChanged" };
  }
  if (evt.backgroundRemoved !== undefined) {
    return { type: "backgroundRemoved" };
  }
  return undefined;
}
