/**
 * Poll-related domain types.
 *
 * Wraps the proto `PollInfo`, `PollOption`, and `PollVote` with branded
 * identifiers.
 */

import type { ChatGuid, MessageGuid } from "./branded.js";

// ---------------------------------------------------------------------------
// PollOption
// ---------------------------------------------------------------------------

/** A single option within a poll. */
export interface PollOption {
  /** The display text for this option. */
  readonly text: string;
  /** Server-assigned identifier for this option. */
  readonly optionIdentifier?: string;
  /** Address of the participant who created this option. */
  readonly creatorHandle?: string;
}

// ---------------------------------------------------------------------------
// PollVote
// ---------------------------------------------------------------------------

/** A single vote cast in a poll. */
export interface PollVote {
  /** The identifier of the option that was voted for. */
  readonly optionIdentifier: string;
  /** Address of the participant who cast this vote. */
  readonly participantAddress?: string;
}

// ---------------------------------------------------------------------------
// PollInfo
// ---------------------------------------------------------------------------

/** A poll attached to a message in a chat. */
export interface PollInfo {
  /** The GUID of the message that contains this poll. */
  readonly messageGuid: MessageGuid;
  /** The GUID of the chat the poll belongs to. */
  readonly chatGuid: ChatGuid;
  /** The poll's title / question. */
  readonly title: string;
  /** The available options to vote on. */
  readonly options: readonly PollOption[];
  /** Votes that have been cast so far. */
  readonly votes: readonly PollVote[];
}
