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

const screenEffects = {
  confetti: "com.apple.messages.effect.CKConfettiEffect",
  fireworks: "com.apple.messages.effect.CKFireworksEffect",
  balloons: "com.apple.messages.effect.CKHappyBirthdayEffect",
  heart: "com.apple.messages.effect.CKHeartEffect",
  lasers: "com.apple.messages.effect.CKLasersEffect",
  celebration: "com.apple.messages.effect.CKSparklesEffect",
  shootingStar: "com.apple.messages.effect.CKShootingStarEffect",
  spotlight: "com.apple.messages.effect.CKSpotlightEffect",
  echo: "com.apple.messages.effect.CKEchoEffect",
} as const;

/**
 * Full-screen and bubble effects that can be applied when sending a message.
 *
 * @example
 * ```ts
 * await im.messages.sendText(chat, "Happy birthday!", {
 *   effect: MessageEffect.confetti,
 * });
 * ```
 */
export const MessageEffect = {
  slam: "com.apple.MobileSMS.expressivesend.impact",
  loud: "com.apple.MobileSMS.expressivesend.loud",
  gentle: "com.apple.MobileSMS.expressivesend.gentle",
  invisible: "com.apple.MobileSMS.expressivesend.invisibleink",
  ...screenEffects,
  sparkles: screenEffects.celebration,

  happyBirthday: screenEffects.balloons,
  congratulations: screenEffects.confetti,
  happyAnniversary: screenEffects.heart,
  wedding: screenEffects.heart,
  engagement: screenEffects.heart,
  babyShower: screenEffects.balloons,
  newBaby: screenEffects.balloons,
  graduation: screenEffects.confetti,
  newJob: screenEffects.balloons,
  promotion: screenEffects.confetti,
  retirement: screenEffects.confetti,
  housewarming: screenEffects.balloons,
  achievement: screenEffects.confetti,
  victory: screenEffects.fireworks,
  grandOpening: screenEffects.confetti,
  productLaunch: screenEffects.spotlight,

  thankYou: screenEffects.heart,
  welcome: screenEffects.balloons,
  welcomeBack: screenEffects.confetti,
  farewell: screenEffects.shootingStar,
  goodLuck: screenEffects.shootingStar,
  getWellSoon: screenEffects.heart,
  thinkingOfYou: screenEffects.heart,
  missYou: screenEffects.heart,
  loveYou: screenEffects.heart,

  happyNewYear: screenEffects.fireworks,
  happyLunarNewYear: screenEffects.celebration,
  happyValentinesDay: screenEffects.heart,
  happyMothersDay: screenEffects.heart,
  happyFathersDay: screenEffects.heart,
  merryChristmas: screenEffects.celebration,
  happyHanukkah: screenEffects.celebration,
  happyEaster: screenEffects.balloons,
  happyHalloween: screenEffects.echo,
  happyThanksgiving: screenEffects.heart,
  happyStPatricksDay: screenEffects.confetti,
  happyIndependenceDay: screenEffects.fireworks,
  happyPride: screenEffects.confetti,
  happyMidAutumnFestival: screenEffects.shootingStar,
  happyDragonBoatFestival: screenEffects.confetti,
  happyLanternFestival: screenEffects.celebration,
  happyQixi: screenEffects.heart,
  happyHoli: screenEffects.confetti,
  happyDiwali: screenEffects.fireworks,
  eidMubarak: screenEffects.shootingStar,
  happyRamadan: screenEffects.shootingStar,
  happyVesak: screenEffects.celebration,
  happySongkran: screenEffects.confetti,
  happyNowruz: screenEffects.fireworks,
  happyRoshHashanah: screenEffects.fireworks,
  happyKwanzaa: screenEffects.celebration,
  happyChuseok: screenEffects.celebration,

  pewPew: screenEffects.lasers,
  surprise: screenEffects.spotlight,
  bigNews: screenEffects.spotlight,
  countdown: screenEffects.fireworks,
  encore: screenEffects.echo,
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
