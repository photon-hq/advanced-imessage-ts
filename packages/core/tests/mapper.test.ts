import { describe, expect, it } from "bun:test";
import { ChatServiceType } from "@photon-ai/aim-core/generated/photon/imessage/v1/address_types";
import { CompanionKind } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_types";
import { GroupChangeEvent } from "@photon-ai/aim-core/generated/photon/imessage/v1/group_types";
import {
  MessageContent,
  MessageReactionKind,
} from "@photon-ai/aim-core/generated/photon/imessage/v1/message_types";
import { PollChangeEvent } from "@photon-ai/aim-core/generated/photon/imessage/v1/poll_types";
import {
  mapChatServiceType,
  mapCompanionKind,
  mapGroupEvent,
  mapMessageContent,
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

  it("preserves inbound mini-app content across protobuf decoding and mapping", () => {
    const bytes = MessageContent.encode(
      MessageContent.create({
        miniApp: {
          appName: "Example App",
          appStoreId: 1_234_567_890,
          extensionBundleId: "codes.photon.Example.MessagesExtension",
          layout: {
            caption: "Caption",
            imageSubtitle: "Image subtitle",
            imageTitle: "Image title",
            subcaption: "Subcaption",
            summary: "Fallback summary",
            trailingCaption: "Trailing",
            trailingSubcaption: "Trailing detail",
          },
          live: true,
          sessionId: "8D898034-407B-4FF5-91E8-9DC18911DCA9",
          teamId: "P8XT6232SL",
          url: "https://example.com/card?id=42",
        },
      })
    ).finish();

    expect(mapMessageContent(MessageContent.decode(bytes)).miniApp).toEqual({
      appName: "Example App",
      appStoreId: 1_234_567_890,
      extensionBundleId: "codes.photon.Example.MessagesExtension",
      layout: {
        caption: "Caption",
        imageSubtitle: "Image subtitle",
        imageTitle: "Image title",
        subcaption: "Subcaption",
        summary: "Fallback summary",
        trailingCaption: "Trailing",
        trailingSubcaption: "Trailing detail",
      },
      live: true,
      sessionId: "8D898034-407B-4FF5-91E8-9DC18911DCA9",
      teamId: "P8XT6232SL",
      url: "https://example.com/card?id=42",
    });
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
