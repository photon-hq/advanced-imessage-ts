import { describe, expect, it } from "bun:test";
import {
  parseChatChangeEvent,
  parseGroupChangeEvent,
  parseMessageChangeEvent,
  parsePollChangeEvent,
} from "../src/events/parse.ts";

/**
 * Fixtures are proto3-JSON exactly as a publisher's generated toJSON would
 * emit them (camelCase fields, RFC3339 timestamps, enum string names) — the
 * wire form events take inside Fusor envelopes.
 */

const OCCURRED_AT = "2026-07-11T18:04:05.123Z";
const ACTOR = {
  address: "+12094503665",
  service: "CHAT_SERVICE_TYPE_IMESSAGE",
};

describe("parseMessageChangeEvent", () => {
  it("parses message.received with Date revival and the given sequence", () => {
    const event = parseMessageChangeEvent(
      {
        chatGuid: "any;-;+12094503665",
        occurredAt: OCCURRED_AT,
        actor: ACTOR,
        isFromMe: false,
        messageReceived: {
          message: {
            guid: "spc-msg-1",
            content: { text: "check this out" },
            dateCreated: "2026-07-11T18:04:05.000Z",
            sender: ACTOR,
            isFromMe: false,
            isSent: true,
            isDelivered: true,
          },
        },
      },
      84_512
    );
    if (event?.type !== "message.received") {
      throw new Error(`expected message.received, got ${event?.type}`);
    }
    expect(event.sequence).toBe(84_512);
    expect(event.chatGuid).toBe("any;-;+12094503665");
    expect(event.isFromMe).toBe(false);
    expect(event.actor?.address).toBe("+12094503665");
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.occurredAt.toISOString()).toBe(OCCURRED_AT);
    expect(event.message.guid).toBe("spc-msg-1");
    expect(event.message.isFromMe).toBe(false);
  });

  it("parses message.reactionAdded", () => {
    const event = parseMessageChangeEvent(
      {
        chatGuid: "any;-;+12094503665",
        occurredAt: OCCURRED_AT,
        actor: ACTOR,
        isFromMe: false,
        reactionAdded: {
          messageGuid: "spc-msg-1",
          reaction: { emoji: "❤️" },
        },
      },
      7
    );
    if (event?.type !== "message.reactionAdded") {
      throw new Error(`expected message.reactionAdded, got ${event?.type}`);
    }
    expect(event.messageGuid).toBe("spc-msg-1");
    expect(event.sequence).toBe(7);
  });

  it("returns undefined for a change this SDK version does not know", () => {
    const event = parseMessageChangeEvent(
      {
        chatGuid: "any;-;+12094503665",
        occurredAt: OCCURRED_AT,
        isFromMe: false,
        // No recognizable oneof member set.
      },
      1
    );
    expect(event).toBeUndefined();
  });

  it("throws on a structurally invalid payload", () => {
    expect(() =>
      parseMessageChangeEvent(
        {
          chatGuid: "any;-;x",
          occurredAt: "not-a-timestamp",
          isFromMe: false,
          messageReceived: { message: { guid: "g" } },
        },
        1
      )
    ).toThrow();
  });
});

describe("parsePollChangeEvent", () => {
  it("parses a vote into poll.changed with its delta", () => {
    const event = parsePollChangeEvent(
      {
        chatGuid: "any;-;+12094503665",
        pollMessageGuid: "spc-poll-1",
        occurredAt: OCCURRED_AT,
        actor: ACTOR,
        isFromMe: false,
        voted: { optionIdentifier: "opt-2" },
      },
      9
    );
    if (event?.type !== "poll.changed") {
      throw new Error(`expected poll.changed, got ${event?.type}`);
    }
    expect(event.pollMessageGuid).toBe("spc-poll-1");
    expect(event.delta).toEqual({ type: "voted", optionIdentifier: "opt-2" });
    expect(event.sequence).toBe(9);
  });
});

describe("parseGroupChangeEvent", () => {
  it("parses participantAdded into group.changed", () => {
    const event = parseGroupChangeEvent(
      {
        chatGuid: "any;+;chat123",
        occurredAt: OCCURRED_AT,
        actor: ACTOR,
        isFromMe: false,
        participantAdded: { participant: { address: "+15551230000" } },
      },
      11
    );
    if (event?.type !== "group.changed") {
      throw new Error(`expected group.changed, got ${event?.type}`);
    }
    expect(event.change.type).toBe("participantAdded");
    expect(event.sequence).toBe(11);
  });
});

describe("parseChatChangeEvent", () => {
  it("parses markedRead into chat.markedRead", () => {
    const event = parseChatChangeEvent(
      {
        chatGuid: "any;-;+12094503665",
        occurredAt: OCCURRED_AT,
        isFromMe: true,
        markedRead: {},
      },
      13
    );
    expect(event?.type).toBe("chat.markedRead");
    expect(event?.sequence).toBe(13);
  });
});
