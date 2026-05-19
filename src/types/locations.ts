/**
 * Shared friend location domain types.
 */

export interface SharedFriendLocation {
  readonly accuracy?: number;
  readonly address: string;
  readonly expiresAt?: Date;
  readonly isLocatingInProgress: boolean;
  readonly latitude?: number;
  readonly locationTimestamp?: Date;
  readonly locationType: "legacy" | "live" | "shallow" | "unknown";
  readonly longAddress?: string;
  readonly longitude?: number;
  readonly name?: string;
  readonly shortAddress?: string;
}

export interface SharedFriendLocationUpdated {
  readonly location: SharedFriendLocation;
  readonly sourceSequence: number;
}

export interface LocationRequestReceipt {
  readonly address: string;
  readonly messageGuid?: string;
  readonly reason?: string;
  readonly requested: boolean;
  readonly requestStatus: string;
}
