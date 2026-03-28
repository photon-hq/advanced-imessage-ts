/**
 * Message effects and text effects.
 *
 * Apple identifies effects by long reverse-DNS strings. These `as const`
 * objects provide friendly names with full autocomplete and type narrowing --
 * the developer never needs to type (or see) the raw identifiers.
 */

// ---------------------------------------------------------------------------
// MessageEffect
// ---------------------------------------------------------------------------

/**
 * Full-screen and bubble effects that can be applied when sending a message.
 *
 * @example
 * ```ts
 * await im.messages.send(chat, "Happy birthday!", {
 *   effect: MessageEffect.confetti,
 * });
 * ```
 */
export const MessageEffect = {
  slam: "com.apple.MobileSMS.expressivesend.impact",
  loud: "com.apple.MobileSMS.expressivesend.loud",
  gentle: "com.apple.MobileSMS.expressivesend.gentle",
  invisible: "com.apple.MobileSMS.expressivesend.invisibleink",
  confetti: "com.apple.messages.effect.CKConfettiEffect",
  fireworks: "com.apple.messages.effect.CKFireworksEffect",
  balloons: "com.apple.messages.effect.CKBalloonEffect",
  heart: "com.apple.messages.effect.CKHeartEffect",
  lasers: "com.apple.messages.effect.CKLasersEffect",
  celebration: "com.apple.messages.effect.CKHappyBirthdayEffect",
  sparkles: "com.apple.messages.effect.CKSparklesEffect",
  spotlight: "com.apple.messages.effect.CKSpotlightEffect",
  echo: "com.apple.messages.effect.CKEchoEffect",
} as const;

/** Union of all valid message-effect ID strings. */
export type MessageEffect = (typeof MessageEffect)[keyof typeof MessageEffect];

// ---------------------------------------------------------------------------
// TextEffect
// ---------------------------------------------------------------------------

/**
 * Per-character text effects (iOS 18+) that animate individual words or
 * phrases within a message.
 */
export const TextEffect = {
  big: "big",
  small: "small",
  shake: "shake",
  nod: "nod",
  explode: "explode",
  ripple: "ripple",
  bloom: "bloom",
  jitter: "jitter",
} as const;

/** Union of all valid text-effect identifier strings. */
export type TextEffect = (typeof TextEffect)[keyof typeof TextEffect];
