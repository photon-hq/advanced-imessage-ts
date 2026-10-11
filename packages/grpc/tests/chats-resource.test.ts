import { describe, expect, it } from "bun:test";
import { ChatsResource } from "../src/v1/resources/chats.ts";

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

    expect(capturedRequest?.clientMessageId).toBe("client-1");
    expect(capturedRequest?.service).toBe(1);
    expect(capturedRequest?.initialMessage).toEqual({
      attributedBody,
      text: "hello",
      effectId: "effect-1",
      subject: "subject-1",
    });
  });

  it("forwards an explicitly empty createChat message to the server", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
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

    await resource.create(["alice@example.com"], { message: "" });

    expect(capturedRequest?.service).toBe(1);
    expect(capturedRequest?.initialMessage).toEqual({
      attributedBody: undefined,
      text: "",
      effectId: undefined,
      subject: undefined,
    });
  });

  it("validates createChat message type before calling transport", async () => {
    let called = false;
    const resource = new ChatsResource({
      async createChat() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(
      resource.create(["alice@example.com"], { message: null as any })
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "message", value: "null" },
      name: "ValidationError",
    });

    await expect(
      resource.create(["alice@example.com"], { message: 123 as any })
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "message", value: "123" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });

  it("validates get chat input before calling transport", async () => {
    let called = false;
    const resource = new ChatsResource({
      async getChat() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(resource.get(null as any)).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "chat", value: "null" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });

  it("sets background with chat guid and bytes only", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const resource = new ChatsResource({
      async setBackground(request: Record<string, unknown>) {
        capturedRequest = request;
        return {};
      },
    } as any);

    await resource.setBackground(" any;+;group1 ", data);

    expect(capturedRequest).toEqual({
      chatGuid: "any;+;group1",
      data,
    });
  });

  it.each([
    ["SMS", 2],
    ["RCS", 3],
  ] as const)("forwards %s as the createChat service", async (service, protoService) => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new ChatsResource({
      async createChat(request: Record<string, unknown>) {
        capturedRequest = request;
        return {
          chat: {
            displayName: "",
            guid: "any;-;+15555550123",
            isArchived: false,
            isFiltered: false,
            isGroup: false,
            participants: [],
            service: protoService,
          },
        };
      },
    } as any);

    await resource.create(["+15555550123"], { service });

    expect(capturedRequest?.service).toBe(protoService);
  });

  it("rejects an unsupported createChat service before calling the server", async () => {
    let called = false;
    const resource = new ChatsResource({
      async createChat() {
        called = true;
        return {};
      },
    } as any);

    await expect(
      resource.create(["+15555550123"], { service: "unknown" as any })
    ).rejects.toThrow("service must be one of iMessage, SMS, or RCS.");
    expect(called).toBe(false);
  });
});
