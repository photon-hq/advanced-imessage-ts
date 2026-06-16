import { fromGrpcError } from "../errors/error-handler.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { PollServiceClient } from "../transport/grpc-client.ts";
import { mapPoll, mapPollEvent } from "../transport/mapper.ts";
import { normalizeChatGuid } from "../types/chat-guid.ts";
import type { IdempotencyOptions } from "../types/common.ts";
import type { PollEvent } from "../types/events.ts";
import type { Poll } from "../types/polls.ts";
import { unwrap } from "../utils/unwrap.ts";

/**
 * Poll APIs.
 *
 * - `create(chat, title, choices, options)` creates a poll message in a chat.
 * - `get(pollMessage)` reads the current poll title, choices, and votes.
 * - `vote(pollMessage, optionId, options)` casts or changes the local
 *   account's vote.
 * - `unvote(pollMessage, options)` removes the local account's vote.
 * - `addOption(pollMessage, text, options)` appends a new choice to a poll.
 * - `subscribeEvents(filter)` streams poll creation, option, vote, and unvote
 *   changes; use `events.catchUp(since)` for disconnect recovery.
 */
export class PollsResource {
  private readonly _client: PollServiceClient;

  constructor(client: PollServiceClient) {
    this._client = client;
  }

  /**
   * Create a poll in `chat` with `title` and an initial set of `choices`.
   *
   * @param chat - An `any;-;...` or `any;+;...` chat guid. In practice, pass
   *               `chat.guid`.
   * @param title - Poll title shown above the choices.
   * @param choices - Initial choice texts.
   */
  async create(
    chat: string,
    title: string,
    choices: string[],
    options?: IdempotencyOptions
  ): Promise<Poll> {
    try {
      const response = await this._client.createPoll({
        chatGuid: normalizeChatGuid(chat),
        title,
        options: choices,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Fetch the current state of a poll (title, choices, votes).
   *
   * @param pollMessage - The guid of the poll message
   *                      (`poll.pollMessageGuid` or any prior result).
   */
  async get(pollMessage: string): Promise<Poll> {
    try {
      const response = await this._client.getPoll({
        pollMessageGuid: pollMessage,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Cast (or re-cast) the current account's vote on a poll.
   *
   * @param pollMessage - The guid of the poll message.
   * @param optionId - The `optionIdentifier` of the chosen choice.
   */
  async vote(
    pollMessage: string,
    optionId: string,
    options?: IdempotencyOptions
  ): Promise<Poll> {
    try {
      const response = await this._client.votePoll({
        pollMessageGuid: pollMessage,
        optionIdentifier: optionId,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Withdraw the current account's vote on a poll.
   *
   * @param pollMessage - The guid of the poll message.
   */
  async unvote(
    pollMessage: string,
    options?: IdempotencyOptions
  ): Promise<Poll> {
    try {
      const response = await this._client.unvotePoll({
        pollMessageGuid: pollMessage,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Append a new choice to an existing poll.
   *
   * @param pollMessage - The guid of the poll message.
   * @param text - The choice's display text.
   */
  async addOption(
    pollMessage: string,
    text: string,
    options?: IdempotencyOptions
  ): Promise<Poll> {
    try {
      const response = await this._client.addPollOption({
        pollMessageGuid: pollMessage,
        optionText: text,
        clientMessageId: options?.clientMessageId,
      });
      return mapPoll(unwrap(response.poll, "poll"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Subscribe to poll lifecycle events (created / option added / voted /
   * unvoted). Vote and unvote events include the affected option identifier.
   *
   * Pass `filter.pollMessage` to scope the stream to a single poll.
   */
  subscribeEvents(filter?: {
    pollMessage?: string;
  }): TypedEventStream<PollEvent> {
    const abort = new AbortController();
    const rpcStream = this._client.subscribePollEvents(
      {
        pollMessageGuid: filter?.pollMessage,
      },
      { signal: abort.signal }
    );

    async function* mapEvents(): AsyncGenerator<PollEvent> {
      try {
        for await (const frame of rpcStream) {
          if (
            frame.sequence === undefined ||
            frame.payload.case !== "pollChanged"
          ) {
            continue;
          }
          const event = mapPollEvent(
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
