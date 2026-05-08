import { describe, expect, it } from "bun:test";
import { ChatsResource } from "../../src/resources/chats.ts";

describe("ChatsResource", () => {
  it("forwards the complete createChat initial message contract", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const attributedBody = new Uint8Array([1, 2, 3]);
    const resource = new ChatsResource({
      async createChat(request: Record<string, unknown>) {
        capturedRequest = request;
        return {
          chat: {
            displayName: "",
            guid: "any;-;alice@example.com",
            isArchived: false,
            isFiltered: false,
            isGroup: false,
            participants: [],
            service: 1,
          },
        };
      },
    } as any);

    await resource.create(["alice@example.com"], {
      attributedBody,
      clientMessageId: "client-1",
      effect: "effect-1" as any,
      message: "hello",
      subject: "subject-1",
    });

    expect(capturedRequest?.initialMessage).toEqual({
      attributedBody,
      text: "hello",
      effectId: "effect-1",
      subject: "subject-1",
      clientMessageId: "client-1",
    });
  });

  it("rejects unsupported createChat service values instead of coercing them", async () => {
    const resource = new ChatsResource({} as any);

    await expect(
      resource.create(["alice@example.com"], { service: "unknown" as any })
    ).rejects.toThrow("Unsupported chat service: unknown");
  });
});
