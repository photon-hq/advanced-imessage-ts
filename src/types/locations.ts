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
  /** Server-assigned identifier for this friend. */
  readonly id: string;
  /** Display name, when available. */
  readonly name?: string;
  /** Latitude in decimal degrees. */
  readonly latitude?: number;
  /** Longitude in decimal degrees. */
  readonly longitude?: number;
  /** Location accuracy radius in meters. */
  readonly accuracy?: number;
  /** When this location fix was taken. */
  readonly locationTimestamp?: Date;
  /** Full street address, when available. */
  readonly longAddress?: string;
  /** Abbreviated address (e.g. city name). */
  readonly shortAddress?: string;
  /** Whether a location fix is currently being acquired. */
  readonly isLocatingInProgress: boolean;
  /** Whether this is a live or shallow (cached) location. */
  readonly locationType: "live" | "shallow";
  /** When this shared location expires. */
  readonly expiresAt?: Date;
}
