import type {
  IdempotencyOptions,
  Poll,
  PollServiceClient,
} from "@photon-ai/aim-core/internal";
import {
  mapPoll,
  normalizeChatGuid,
  toIMessageError,
  unwrap,
} from "@photon-ai/aim-core/internal";

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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
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
      throw toIMessageError(err);
    }
  }
}
