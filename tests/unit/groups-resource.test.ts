import { describe, expect, it } from "bun:test";
import { GroupsResource } from "../../src/resources/groups.ts";

function makeChat(displayName = "Team") {
  return {
    chatIdentifier: "team",
    displayName,
    guid: "any;+;team",
    isArchived: false,
    isFiltered: false,
    isGroup: true,
    participants: [],
    service: 1,
  };
}

describe("GroupsResource", () => {
  it("trims and forwards setDisplayName input", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new GroupsResource({
      async setDisplayName(request: Record<string, unknown>) {
        capturedRequest = request;
        return { chat: makeChat(request.displayName as string) };
      },
    } as any);

    const chat = await resource.setDisplayName(" any;+;team ", "  New Team  ", {
      clientMessageId: "rename-1",
    });

    expect(capturedRequest).toEqual({
      chatGuid: "any;+;team",
      clientMessageId: "rename-1",
      displayName: "New Team",
    });
    expect(chat.displayName).toBe("New Team");
  });

  it("validates displayName type before calling transport", async () => {
    let called = false;
    const resource = new GroupsResource({
      async setDisplayName() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(
      resource.setDisplayName("any;+;team", 123 as any)
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "display_name", value: "123" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });

  it("validates blank displayName before calling transport", async () => {
    let called = false;
    const resource = new GroupsResource({
      async setDisplayName() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(
      resource.setDisplayName("any;+;team", "   ")
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "display_name" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });

  it("trims and forwards addParticipants addresses", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const resource = new GroupsResource({
      async addParticipants(request: Record<string, unknown>) {
        capturedRequest = request;
        return { chat: makeChat() };
      },
    } as any);

    await resource.addParticipants(" any;+;team ", [
      "  alice@example.com  ",
      "  +14155550123  ",
    ]);

    expect(capturedRequest).toEqual({
      addresses: ["alice@example.com", "+14155550123"],
      chatGuid: "any;+;team",
      clientMessageId: undefined,
    });
  });

  it("validates addParticipants addresses shape before calling transport", async () => {
    let called = false;
    const resource = new GroupsResource({
      async addParticipants() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(
      resource.addParticipants("any;+;team", "alice@example.com" as any)
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "addresses", value: "alice@example.com" },
      name: "ValidationError",
    });

    await expect(
      resource.addParticipants("any;+;team", [123] as any)
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "addresses[0]", value: "123" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });

  it("validates sparse participant address arrays before calling transport", async () => {
    let called = false;
    const resource = new GroupsResource({
      async addParticipants() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(
      resource.addParticipants("any;+;team", new Array(1) as string[])
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "addresses[0]", value: "undefined" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });

  it("validates removeParticipants addresses shape before calling transport", async () => {
    let called = false;
    const resource = new GroupsResource({
      async removeParticipants() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(
      resource.removeParticipants("any;+;team", null as any)
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "addresses", value: "null" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });

  it("validates setIcon data shape before calling transport", async () => {
    let called = false;
    const resource = new GroupsResource({
      async setIcon() {
        called = true;
        throw new Error("transport should not be called");
      },
    } as any);

    await expect(
      resource.setIcon("any;+;team", "not-bytes" as any)
    ).rejects.toMatchObject({
      code: "invalidArgument",
      context: { field: "data", value: "not-bytes" },
      name: "ValidationError",
    });

    expect(called).toBe(false);
  });
});
