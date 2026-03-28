/**
 * Tapback reactions.
 *
 * Apple's iMessage supports a fixed set of tapback reactions plus emoji and
 * sticker reactions (iOS 17+). This `as const` object maps friendly names to
 * wire-format identifiers.
 */

export const Reaction = {
  love: "love",
  like: "like",
  dislike: "dislike",
  laugh: "laugh",
  emphasize: "emphasize",
  question: "question",
  emoji: "emoji",
  sticker: "sticker",
} as const;

/** Union of all valid reaction identifier strings. */
export type Reaction = (typeof Reaction)[keyof typeof Reaction];
