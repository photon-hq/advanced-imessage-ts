/**
 * Group chat management types.
 *
 * Types specific to group operations (backgrounds, icons, participants)
 * that go beyond the base `Chat` interface.
 */

// ---------------------------------------------------------------------------
// BackgroundInfo
// ---------------------------------------------------------------------------

/** Metadata about a group chat's custom background image. */
export interface BackgroundInfo {
  /** Channel-level GUID for the background, if applicable. */
  readonly channelGuid?: string;
  /** URL of the background image. */
  readonly imageUrl?: string;
  /** Server-assigned background identifier. */
  readonly backgroundId?: string;
}
