/**
 * Poll-related domain types.
 *
 * Mirrors the gRPC `poll_service.proto` types with branded identifiers and
 * a discriminated union for the per-action event payload.
 */

import type { ChatGuid, MessageGuid } from "./branded.js";

// ---------------------------------------------------------------------------
// PollOption
// ---------------------------------------------------------------------------

/** A single option within a poll. */
export interface PollOption {
  /** Address of the participant who created this option. */
  readonly creatorHandle?: string;
  /** Server-assigned identifier for this option. */
  readonly optionIdentifier?: string;
  /** The display text for this option. */
  readonly text: string;
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
  /** The GUID of the chat the poll belongs to. */
  readonly chatGuid: ChatGuid;
  /** The GUID of the message that contains this poll. */
  readonly messageGuid: MessageGuid;
  /** The available options to vote on. */
  readonly options: readonly PollOption[];
  /** The poll's title / question. */
  readonly title: string;
  /** Votes that have been cast so far. */
  readonly votes: readonly PollVote[];
}

// ---------------------------------------------------------------------------
// PollActor
// ---------------------------------------------------------------------------

/**
 * Who triggered a poll change.
 *
 * For self-initiated changes — including those written from another of the
 * user's devices — `isFromMe` is `true` and `address` is typically
 * `undefined` (chat.db does not store a handle row for the local account).
 */
export interface PollActor {
  /**
   * Handle address (e.g. `"user@example.com"`, `"+14155550123"`), if the
   * underlying chat.db row carries a resolvable handle.
   */
  readonly address?: string;
  /** True when the change was written by the local iMessage account. */
  readonly isFromMe: boolean;
}

// ---------------------------------------------------------------------------
// PollChangeDelta
// ---------------------------------------------------------------------------

/**
 * Per-action payload for a poll change. Discriminated by `type`.
 *
 * - `created` / `optionAdded` ship the complete post-change poll state —
 *   the UI can render without an extra `polls.get()` round-trip.
 * - `voted` ships the actor's current full selection (iMessage's vote
 *   protocol represents votes as the voter's picks, not deltas).
 * - `unvoted` has no extra fields (iMessage has no per-option unvote).
 */
export type PollChangeDelta =
  | {
      readonly type: "created";
      readonly title: string;
      readonly options: readonly PollOption[];
    }
  | {
      readonly type: "optionAdded";
      readonly title: string;
      readonly options: readonly PollOption[];
    }
  | {
      readonly type: "voted";
      readonly optionIdentifiers: readonly string[];
    }
  | {
      readonly type: "unvoted";
    };
