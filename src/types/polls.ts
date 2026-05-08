/**
 * Poll-related domain types.
 */

import type { SingleServiceAddressInfo } from "./addresses.js";

export interface PollOption {
  readonly creatorHandle?: string;
  readonly optionIdentifier: string;
  readonly text: string;
}

export interface PollParticipantVote {
  readonly optionIdentifier: string;
  readonly participant: SingleServiceAddressInfo;
}

export interface Poll {
  readonly chatGuid: string;
  readonly options: readonly PollOption[];
  readonly pollMessageGuid: string;
  readonly title: string;
  readonly votes: readonly PollParticipantVote[];
}

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
      readonly optionIdentifier: string;
    }
  | {
      readonly type: "unvoted";
    };
