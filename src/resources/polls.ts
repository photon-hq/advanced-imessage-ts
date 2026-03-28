/**
 * PollsResource -- poll creation, voting, and event streaming.
 *
 * Wraps the gRPC PollService to provide high-level methods for creating
 * polls, casting votes, adding options, and subscribing to poll events.
 */

import { fromGrpcError } from "../errors/error-handler.ts";
import type { PollChangeEvent } from "../generated/photon/imessage/v1/poll_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { PollServiceClient } from "../transport/grpc-client.ts";
import { mapMessage, mapPollInfo } from "../transport/mapper.ts";
import type { ChatGuid, MessageGuid } from "../types/branded.ts";
import { chatGuid, messageGuid } from "../types/branded.ts";
import type { CommandReceipt } from "../types/common.ts";
import type { PollEvent } from "../types/events.ts";
import type { PollInfo } from "../types/polls.ts";
import { unwrap } from "../utils/unwrap.ts";

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export class PollsResource {
  private readonly _client: PollServiceClient;

  constructor(client: PollServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /** Create a new poll in the given chat. */
  async create(
    chat: ChatGuid,
    title: string,
    options: string[]
  ): Promise<CommandReceipt> {
    try {
      const response = await this._client.createPoll({
        chatGuid: chat,
        title,
        options,
      });
      return { guid: messageGuid(unwrap(response.receipt, "receipt").guid) };
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Vote on a poll option. */
  async vote(
    chat: ChatGuid,
    pollMessage: MessageGuid,
    optionIdentifier: string
  ): Promise<CommandReceipt> {
    try {
      const response = await this._client.vote({
        chatGuid: chat,
        pollMessageGuid: pollMessage,
        optionIdentifier,
      });
      return { guid: messageGuid(unwrap(response.receipt, "receipt").guid) };
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Remove your vote from a poll. */
  async unvote(
    chat: ChatGuid,
    pollMessage: MessageGuid
  ): Promise<CommandReceipt> {
    try {
      const response = await this._client.unvote({
        chatGuid: chat,
        pollMessageGuid: pollMessage,
      });
      return { guid: messageGuid(unwrap(response.receipt, "receipt").guid) };
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Add a new option to an existing poll. */
  async addOption(
    chat: ChatGuid,
    pollMessage: MessageGuid,
    optionText: string
  ): Promise<CommandReceipt> {
    try {
      const response = await this._client.addOption({
        chatGuid: chat,
        pollMessageGuid: pollMessage,
        optionText,
      });
      return { guid: messageGuid(unwrap(response.receipt, "receipt").guid) };
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** Get poll info by the message GUID that contains the poll. */
  async get(messageGuidValue: MessageGuid): Promise<PollInfo> {
    try {
      const response = await this._client.getPoll({
        messageGuid: messageGuidValue,
      });
      return mapPollInfo(unwrap(response.poll, "poll"));
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  /** Subscribe to poll change events. Returns a typed event stream. */
  subscribe(): TypedEventStream<PollEvent> {
    const rpcStream = this._client.subscribePollEvents({});

    async function* mapEvents(): AsyncGenerator<PollEvent> {
      try {
        for await (const proto of rpcStream) {
          const timestamp = proto.timestamp ?? new Date();

          if (proto.pollChanged === undefined) {
            continue;
          }

          const evt: PollChangeEvent = proto.pollChanged;

          yield {
            type: "poll.changed" as const,
            chatGuid: chatGuid(evt.chatGuid),
            pollMessageGuid: messageGuid(evt.pollMessageGuid),
            message: mapMessage(unwrap(evt.message, "message")),
            action: mapPollAction(evt.action),
            timestamp,
          };
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream<PollEvent>(mapEvents());
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a proto poll action string to the SDK PollEvent action literal.
 */
function mapPollAction(
  action: string
): "created" | "voted" | "unvoted" | "optionAdded" {
  switch (action) {
    case "created":
      return "created";
    case "voted":
      return "voted";
    case "unvoted":
      return "unvoted";
    case "optionAdded":
    case "option_added":
      return "optionAdded";
    default:
      return "created";
  }
}
