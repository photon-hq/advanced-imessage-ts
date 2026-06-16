import { describe, expect, it } from "bun:test";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { ChatServiceType } from "../../src/generated/photon/imessage/v1/address_types_pb.js";
import { CompanionKind } from "../../src/generated/photon/imessage/v1/attachment_types_pb.js";
import { GroupChangeEventSchema } from "../../src/generated/photon/imessage/v1/group_types_pb.js";
import {
  type MessageReactionKind,
  MessageReactionSchema,
} from "../../src/generated/photon/imessage/v1/message_types_pb.js";
import { PollChangeEventSchema } from "../../src/generated/photon/imessage/v1/poll_types_pb.js";
import {
  mapChatServiceType,
  mapCompanionKind,
  mapGroupEvent,
  mapMessageReaction,
  mapPollEvent,
} from "../../src/transport/mapper.ts";

const occurredAt = timestampFromDate(new Date("2026-05-05T00:00:00.000Z"));

describe("mapper", () => {
  it("surfaces unknown chat services instead of coercing them to iMessage", () => {
    expect(mapChatServiceType(ChatServiceType.UNSPECIFIED)).toBe("unknown");
  });

  it("surfaces unknown companion kinds instead of coercing them to live-photo-video", () => {
    expect(mapCompanionKind(CompanionKind.UNSPECIFIED)).toBe("unknown");
  });

  it("surfaces unknown message reactions instead of coercing them to sticker", () => {
    const reaction = create(MessageReactionSchema, {
      kind: 99 as MessageReactionKind,
    });
    expect(mapMessageReaction(reaction).kind).toBe("unknown");
  });

  it("drops group events whose oneof payload is absent", () => {
    expect(
      mapGroupEvent(
        7,
        create(GroupChangeEventSchema, {
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
        create(PollChangeEventSchema, {
          chatGuid: "iMessage;-;group",
          pollMessageGuid: "poll-message-guid",
          occurredAt,
        })
      )
    ).toBeUndefined();
  });
});
