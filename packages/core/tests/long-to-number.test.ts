import { describe, expect, it } from "bun:test";
import { Timestamp } from "../src/generated/google/protobuf/timestamp.ts";
import { SubscribePollEventsResponse } from "../src/generated/photon/imessage/v1/poll_service.ts";

// Far past Number.MAX_SAFE_INTEGER (2^53 - 1). ts-proto types these fields as
// `number`, but the wire format can carry the full signed/unsigned 64-bit
// range, so the cast is required to construct a regression fixture for #23.
const OVERSIZED_UINT64 = Number("18446744073709551615"); // 2^64 - 1 (max uint64)
const OVERSIZED_INT64 = Number("9223372036854775807"); // 2^63 - 1 (max int64)

describe("longToNumber overflow handling (issue #23)", () => {
  it("decodes a top-level oversized uint64 sequence without throwing", () => {
    const bytes = SubscribePollEventsResponse.encode(
      SubscribePollEventsResponse.create({
        sequence: OVERSIZED_UINT64,
        pollChanged: {
          chatGuid: "iMessage;-;+15551234567",
          pollMessageGuid: "poll-guid",
          occurredAt: new Date("2026-07-16T00:00:00Z"),
          isFromMe: false,
          created: { title: "Lunch?", options: [] },
        },
      })
    ).finish();

    const decoded = SubscribePollEventsResponse.decode(bytes);

    expect(decoded.pollChanged?.created?.title).toBe("Lunch?");
    expect(typeof decoded.sequence).toBe("number");
    expect(Number.isFinite(decoded.sequence)).toBe(true);
  });

  it("decodes a nested Timestamp.seconds oversized past MAX_SAFE_INTEGER without throwing", () => {
    const bytes = Timestamp.encode(
      Timestamp.create({ seconds: OVERSIZED_INT64, nanos: 0 })
    ).finish();

    expect(() => Timestamp.decode(bytes)).not.toThrow();

    const decoded = Timestamp.decode(bytes);
    expect(typeof decoded.seconds).toBe("number");
    expect(Number.isFinite(decoded.seconds)).toBe(true);
  });
});
