import { describe, expect, it } from "bun:test";
import { EventsResource } from "../src/v1/resources/events.ts";

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
