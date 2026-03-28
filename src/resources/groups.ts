/**
 * GroupsResource -- group chat management operations.
 *
 * Wraps the gRPC GroupService to provide high-level methods for managing
 * group chat properties: display name, participants, icon, and background.
 * Also exposes a `subscribe()` method for streaming group change events.
 */

import type { ChatGuid } from "../types/branded.ts";
import type { Chat } from "../types/chats.ts";
import type { BackgroundInfo } from "../types/groups.ts";
import type { GroupEvent, GroupChange } from "../types/events.ts";
import type { IGroupServiceClient } from "../transport/grpc-client.ts";
import { mapChat, timestampToDate } from "../transport/mapper.ts";
import { chatGuid } from "../types/branded.ts";
import { fromGrpcError } from "../errors/error-handler.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { GroupChangeEvent } from "../generated/photon/imessage/v1/group_service.ts";

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export class GroupsResource {
  private readonly _client: IGroupServiceClient;

  constructor(client: IGroupServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // Display name
  // -------------------------------------------------------------------------

  /** Rename a group chat. Returns the updated chat. */
  async setDisplayName(chat: ChatGuid, name: string): Promise<Chat> {
    try {
      const { response } = await this._client.setDisplayName({
        chatGuid: chat,
        name,
      });
      return mapChat(response.chat!);
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
      const { response } = await this._client.addParticipant({
        chatGuid: chat,
        address,
      });
      return mapChat(response.chat!);
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Remove a participant from a group chat by address. Returns the updated chat. */
  async removeParticipant(chat: ChatGuid, address: string): Promise<Chat> {
    try {
      const { response } = await this._client.removeParticipant({
        chatGuid: chat,
        address,
      });
      return mapChat(response.chat!);
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
      const { response } = await this._client.getIcon({ chatGuid: chat });
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
    data: Uint8Array,
  ): Promise<BackgroundInfo> {
    try {
      const { response } = await this._client.setBackground({
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
      const { response } = await this._client.getBackground({ chatGuid: chat });
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
    const rpcCall = this._client.subscribeGroupEvents({});

    async function* mapEvents(): AsyncGenerator<GroupEvent> {
      try {
        for await (const proto of rpcCall.responses) {
          const timestamp = proto.timestamp
            ? timestampToDate(proto.timestamp)
            : new Date();

          if (proto.payload.oneofKind !== "groupChanged") continue;

          const evt = (proto.payload as any).groupChanged as GroupChangeEvent;
          const change = mapGroupChange(evt.change);
          if (!change) continue;

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
 * Map a proto GroupChangeEvent's `change` oneof to the SDK GroupChange
 * discriminated union. The `change` parameter is the raw oneof value from
 * the proto GroupChangeEvent.
 */
function mapGroupChange(
  change: {
    oneofKind: string | undefined;
    [key: string]: unknown;
  },
): GroupChange | undefined {
  switch (change.oneofKind) {
    case "renamedTo":
      return { type: "renamed", name: change.renamedTo as string };
    case "participantAdded":
      return { type: "participantAdded", address: change.participantAdded as string };
    case "participantRemoved":
      return {
        type: "participantRemoved",
        address: change.participantRemoved as string,
      };
    case "iconChanged":
      return { type: "iconChanged" };
    case "iconRemoved":
      return { type: "iconRemoved" };
    case "backgroundChanged":
      return { type: "backgroundChanged" };
    case "backgroundRemoved":
      return { type: "backgroundRemoved" };
    case undefined:
      return undefined;
    default:
      return undefined;
  }
}
