import { expect, it } from "bun:test";
import { MessageEffect } from "../src/types/effects.ts";

it("maps balloons to Apple's Balloons effect identifier", () => {
  expect(MessageEffect.balloons).toBe(
    "com.apple.messages.effect.CKHappyBirthdayEffect"
  );
});

it("maps celebration and sparkles to Apple's Celebration effect identifier", () => {
  expect(MessageEffect.celebration).toBe(
    "com.apple.messages.effect.CKSparklesEffect"
  );
  expect(MessageEffect.sparkles).toBe(
    "com.apple.messages.effect.CKSparklesEffect"
  );
});

it.each([
  [
    MessageEffect.happyBirthday,
    "com.apple.messages.effect.CKHappyBirthdayEffect",
  ],
  [MessageEffect.happyNewYear, "com.apple.messages.effect.CKFireworksEffect"],
  [
    MessageEffect.happyLunarNewYear,
    "com.apple.messages.effect.CKSparklesEffect",
  ],
  [MessageEffect.happyHoli, "com.apple.messages.effect.CKConfettiEffect"],
  [MessageEffect.happyDiwali, "com.apple.messages.effect.CKFireworksEffect"],
  [MessageEffect.eidMubarak, "com.apple.messages.effect.CKShootingStarEffect"],
  [
    MessageEffect.happyRamadan,
    "com.apple.messages.effect.CKShootingStarEffect",
  ],
  [MessageEffect.pewPew, "com.apple.messages.effect.CKLasersEffect"],
] as const)("preserves the native association for %s", (effect, expected) => {
  expect(effect).toBe(expected);
});
