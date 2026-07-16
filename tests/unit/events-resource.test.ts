import { describe, expect, it } from "bun:test";
import { CatchUpEventsResponse } from "../../src/generated/photon/imessage/v1/event_service.ts";
import { decodeCatchUpEvent } from "../../src/index.ts";
import { EventsResource } from "../../src/resources/events.ts";

const RECEIVED_AT = new Date("2026-07-16T01:02:03.456Z");

// Produced by fusor-fanin-imessage's independent protobufjs delivery transform.
// Keeping the bytes fixed catches field-number drift between the two repos.
const FUSOR_RECEIVED_FRAME = Uint8Array.from(
  Buffer.from(
    "CCpSuwEKF2lNZXNzYWdlOy07KzE1NTUxMjM0NTY3EgwIi9vg0gYQgIS42QEaFAoMKzE1NTUxMjM0NTY3EAEaAlVTUnwKegoUc3BjLW1zZy1tZXNzYWdlLWd1aWQSEgoQaGVsbG8gZnJvbSBmdXNvclIMCIvb4NIGEICEuNkBogEUCgwrMTU1NTEyMzQ1NjcQARoCVVPaBA5wOisxNTU1MDAwMTExMeIFF2lNZXNzYWdlOy07KzE1NTUxMjM0NTY3",
    "base64"
  )
);

describe("decodeCatchUpEvent", () => {
  it("decodes and maps a received-message frame", () => {
    expect(decodeCatchUpEvent(FUSOR_RECEIVED_FRAME)).toMatchObject({
      actor: {
        address: "+15551234567",
        country: "US",
        service: "iMessage",
      },
      chatGuid: "iMessage;-;+15551234567",
      isFromMe: false,
      message: {
        chatGuids: ["iMessage;-;+15551234567"],
        content: {
          attachments: [],
          formatting: [],
          mentions: [],
          text: "hello from fusor",
        },
        dateCreated: RECEIVED_AT,
        destinationCallerId: "p:+15550001111",
        guid: "spc-msg-message-guid",
        isFromMe: false,
        sender: {
          address: "+15551234567",
          country: "US",
          service: "iMessage",
        },
      },
      occurredAt: RECEIVED_AT,
      sequence: 42,
      type: "message.received",
    });
  });

  it("maps the terminal catch-up frame", () => {
    const bytes = CatchUpEventsResponse.encode(
      CatchUpEventsResponse.create({ complete: { headSequence: 84 } })
    ).finish();

    expect(decodeCatchUpEvent(bytes)).toEqual({
      type: "catchup.complete",
      headSequence: 84,
    });
  });

  it("returns undefined for a heartbeat frame", () => {
    const bytes = CatchUpEventsResponse.encode(
      CatchUpEventsResponse.create({ heartbeat: {} })
    ).finish();

    expect(decodeCatchUpEvent(bytes)).toBeUndefined();
  });

  it("returns undefined for a valid frame without an event payload", () => {
    const bytes = CatchUpEventsResponse.encode(
      CatchUpEventsResponse.create({ sequence: 42 })
    ).finish();

    expect(decodeCatchUpEvent(bytes)).toBeUndefined();
  });

  it("propagates generated protobuf decoder errors", () => {
    expect(() => decodeCatchUpEvent(Uint8Array.of(0xff))).toThrow();
  });
});

describe("EventsResource", () => {
  it("validates catch-up cursor before calling transport", async () => {
    let called = false;
    const resource = new EventsResource({
      catchUpEvents() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    expect(() => resource.catchUp(-1)).toThrow(
      "since must be a non-negative safe integer."
    );

    expect(called).toBe(false);
  });

  it("rejects non-integer catch-up cursors before serialization", () => {
    const resource = new EventsResource({
      catchUpEvents() {
        throw new Error("transport should not be called");
      },
    } as any);

    expect(() => resource.catchUp(30.5)).toThrow(
      "since must be a non-negative safe integer."
    );
  });

  it("forwards an omitted catch-up cursor", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new EventsResource({
      async *catchUpEvents(request: Record<string, unknown>) {
        capturedRequest = request;
        yield* [];
      },
    } as any);

    for await (const _event of resource.catchUp()) {
      // Drain the finite test stream.
    }

    expect(capturedRequest).toEqual({ afterSequence: undefined });
  });

  it("forwards a valid catch-up cursor", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new EventsResource({
      async *catchUpEvents(request: Record<string, unknown>) {
        capturedRequest = request;
        yield* [];
      },
    } as any);

    for await (const _event of resource.catchUp(30)) {
      // Drain the finite test stream.
    }

    expect(capturedRequest).toEqual({ afterSequence: 30 });
  });
});
