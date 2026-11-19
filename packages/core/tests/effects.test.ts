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
