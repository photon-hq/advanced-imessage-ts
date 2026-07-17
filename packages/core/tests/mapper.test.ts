import { describe, expect, it } from "bun:test";
import { ChatServiceType } from "@photon-ai/aim-core/generated/photon/imessage/v1/address_types";
import { CompanionKind } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_types";
import { GroupChangeEvent } from "@photon-ai/aim-core/generated/photon/imessage/v1/group_types";
import { MessageReactionKind } from "@photon-ai/aim-core/generated/photon/imessage/v1/message_types";
import { PollChangeEvent } from "@photon-ai/aim-core/generated/photon/imessage/v1/poll_types";
import {
  mapChatServiceType,
  mapCompanionKind,
  mapGroupEvent,
  mapMessageReaction,
  mapPollEvent,
} from "../src/mapper.ts";

const occurredAt = new Date("2026-05-05T00:00:00.000Z");

describe("mapper", () => {
  it("surfaces unknown chat services instead of coercing them to iMessage", () => {
    expect(
      mapChatServiceType(ChatServiceType.CHAT_SERVICE_TYPE_UNSPECIFIED)
    ).toBe("unknown");
    expect(mapChatServiceType(ChatServiceType.UNRECOGNIZED)).toBe("unknown");
  });

  it("surfaces unknown companion kinds instead of coercing them to live-photo-video", () => {
    expect(mapCompanionKind(CompanionKind.COMPANION_KIND_UNSPECIFIED)).toBe(
      "unknown"
    );
    expect(mapCompanionKind(CompanionKind.UNRECOGNIZED)).toBe("unknown");
  });

  it("surfaces unknown message reactions instead of coercing them to sticker", () => {
    expect(
      mapMessageReaction({
        kind: MessageReactionKind.UNRECOGNIZED,
        emoji: undefined,
      }).kind
    ).toBe("unknown");
  });

  it("drops group events whose oneof payload is absent", () => {
    expect(
      mapGroupEvent(
        7,
        GroupChangeEvent.create({
          chatGuid: "iMessage;-;group",
          occurredAt,
        })
      )
    ).toBeUndefined();
  });

  it("drops poll events whose oneof payload is absent", () => {
    expect(
      mapPollEvent(
        9,
        PollChangeEvent.create({
          chatGuid: "iMessage;-;group",
          pollMessageGuid: "poll-message-guid",
          occurredAt,
        })
      )
    ).toBeUndefined();
  });
});
