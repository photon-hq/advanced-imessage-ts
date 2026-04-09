/**
 * Find My Friends / location domain types.
 *
 * Wraps the proto `FindMyFriend` with `Date` timestamps and string-literal
 * location types.
 */

// ---------------------------------------------------------------------------
// FindMyFriend
// ---------------------------------------------------------------------------

/** Location data for a friend in Find My. */
export interface FindMyFriend {
  /** Location accuracy radius in meters. */
  readonly accuracy?: number;
  /** When this shared location expires. */
  readonly expiresAt?: Date;
  /** Server-assigned identifier for this friend. */
  readonly id: string;
  /** Whether a location fix is currently being acquired. */
  readonly isLocatingInProgress: boolean;
  /** Latitude in decimal degrees. */
  readonly latitude?: number;
  /** When this location fix was taken. */
  readonly locationTimestamp?: Date;
  /** Whether this is a live, shallow (cached), or legacy location. */
  readonly locationType: "legacy" | "live" | "shallow";
  /** Full street address, when available. */
  readonly longAddress?: string;
  /** Longitude in decimal degrees. */
  readonly longitude?: number;
  /** Display name, when available. */
  readonly name?: string;
  /** Abbreviated address (e.g. city name). */
  readonly shortAddress?: string;
}
