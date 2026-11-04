import { expect, test } from "bun:test";
import {
  decodeCatchUpEvent,
  parseMessageChangeEvent,
} from "../src/events/parse.ts";
import { CatchUpEventsResponse } from "../src/generated/photon/imessage/v1/event_service.ts";
import { Message } from "../src/generated/photon/imessage/v1/message_types.ts";
import { mapMessage } from "../src/mapper.ts";

const senderDeviceId = `pho_device_v1_${"a".repeat(43)}`;

test.each([
  senderDeviceId,
  undefined,
])("preserves optional identity through binary, JSON, and SDK mapping: %s", (identity) => {
  const message = Message.create({
    content: { text: "Hello" },
    dateCreated: new Date("2026-11-01T00:00:00Z"),
    guid: "sender-device-message",
    senderDeviceId: identity,
  });
  const binary = Message.decode(Message.encode(message).finish());
  const json = Message.fromJSON(Message.toJSON(binary));
  expect(mapMessage(json).senderDeviceId).toBe(identity);
  expect(
    JSON.stringify(Message.toJSON(binary)).includes("senderDeviceId")
  ).toBe(identity !== undefined);
  const frame = CatchUpEventsResponse.create({
    messageChanged: {
      messageReceived: { message },
      occurredAt: message.dateCreated,
    },
    sequence: 7,
  });
  const decoded = decodeCatchUpEvent(
    CatchUpEventsResponse.encode(frame).finish()
  );
  const parsed = parseMessageChangeEvent(
    (CatchUpEventsResponse.toJSON(frame) as { messageChanged: unknown })
      .messageChanged,
    7
  );
  for (const event of [decoded, parsed]) {
    if (event?.type !== "message.received") {
      throw new Error("Expected a received message event");
    }
    expect(event.message.senderDeviceId).toBe(identity);
  }
});
