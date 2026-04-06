/**
 * Tests for per-chat ordered send in MessagesResource.
 *
 * Sends to the same chat are always serialised; different chats are concurrent.
 */

import { describe, expect, it } from "bun:test";
import { MessagesResource } from "../../src/resources/messages.ts";
import type { ChatGuid } from "../../src/types/branded.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockClient(delay = 0) {
  const calls: Array<{ chat: string; order: number }> = [];
  let callCount = 0;
  const inFlight = { current: 0, peak: 0 };

  const client = {
    send: async (request: { chatGuid: string }) => {
      const order = callCount++;
      calls.push({ chat: request.chatGuid, order });
      inFlight.current++;
      inFlight.peak = Math.max(inFlight.peak, inFlight.current);
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
      inFlight.current--;
      return {
        receipt: { guid: `msg-${order}`, clientMessageId: undefined },
      };
    },
  };

  return { client: client as any, calls, inFlight };
}

function createFailingClient(failOnCall: number) {
  let callCount = 0;
  const calls: number[] = [];

  const client = {
    send: async (_request: { chatGuid: string }) => {
      const order = callCount++;
      calls.push(order);
      if (order === failOnCall) {
        throw new Error("test failure");
      }
      return {
        receipt: { guid: `msg-${order}`, clientMessageId: undefined },
      };
    },
  };

  return { client: client as any, calls };
}

const chatA = "iMessage;-;alice@icloud.com" as ChatGuid;
const chatB = "iMessage;-;bob@icloud.com" as ChatGuid;
const chatC = "iMessage;-;charlie@icloud.com" as ChatGuid;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MessagesResource ordered send", () => {
  it("preserves order for same-chat sends", async () => {
    const { client, calls } = createMockClient(10);
    const messages = new MessagesResource(client);

    const p1 = messages.send(chatA, "first");
    const p2 = messages.send(chatA, "second");
    const p3 = messages.send(chatA, "third");

    await Promise.all([p1, p2, p3]);

    const chatACalls = calls.filter((c) => c.chat === chatA);
    expect(chatACalls.map((c) => c.order)).toEqual([0, 1, 2]);
  });

  it("allows concurrent sends to different chats", async () => {
    const { client, inFlight } = createMockClient(20);
    const messages = new MessagesResource(client);

    const p1 = messages.send(chatA, "to A");
    const p2 = messages.send(chatB, "to B");
    const p3 = messages.send(chatC, "to C");

    await Promise.all([p1, p2, p3]);

    expect(inFlight.peak).toBe(3);
  });

  it("continues after a preceding message fails", async () => {
    const { client, calls } = createFailingClient(0);
    const messages = new MessagesResource(client);

    const p1 = messages.send(chatA, "will fail");
    const p2 = messages.send(chatA, "should succeed");

    await expect(p1).rejects.toThrow();
    const receipt = await p2;
    expect(receipt.guid).toBeDefined();

    expect(calls).toEqual([0, 1]);
  });

  it("cleans up chain entries after completion", async () => {
    const { client } = createMockClient();
    const messages = new MessagesResource(client);

    await messages.send(chatA, "hello");

    // Flush microtask queue for the chain cleanup callback.
    await new Promise((r) => setTimeout(r, 0));

    const chains = (messages as any)._chains as Map<string, Promise<void>>;
    expect(chains.size).toBe(0);
  });

  it("returns correct receipts for each send", async () => {
    const { client } = createMockClient(5);
    const messages = new MessagesResource(client);

    const p1 = messages.send(chatA, "first");
    const p2 = messages.send(chatA, "second");

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.guid).toBe("msg-0");
    expect(r2.guid).toBe("msg-1");
  });
});
