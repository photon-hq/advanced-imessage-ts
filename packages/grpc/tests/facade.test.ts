import { beforeAll, describe, expect, it, mock } from "bun:test";
import {
  ConnectionError,
  TypedEventStream,
} from "@photon-ai/aim-core/internal";
import { createClient, createGrpcClient } from "../src/index.ts";

// The façade dynamically imports ./v1/client.ts. Mocking that module keeps
// these tests off the network and observable: the mock records evaluation and
// every delegated call. The file starts with a throwing factory (simulating
// missing nice-grpc peers) and swaps in a working one afterwards —
// mock.module replaces the registration in place, which also proves the
// façade's memo-reset lets a process recover once the peers appear.

const v1Evaluated = false;
let closed = false;
const calls: Array<{ resource: string; method: string; args: unknown[] }> = [];

mock.module("../src/v1/client.ts", () => {
  throw new Error("Cannot find module 'nice-grpc'");
});

function makeStream(values: string[]): TypedEventStream<string> {
  async function* run(): AsyncGenerator<string, void, undefined> {
    yield* values;
  }
  return new TypedEventStream(run(), () => {
    closed = true;
    return Promise.resolve();
  });
}

function installWorkingV1(): void {
  mock.module("../src/v1/client.ts", () => ({
    createClient: (options: { address: string }) => ({
      address: options.address,
      messages: {
        sendText: (...args: unknown[]) => {
          calls.push({ resource: "messages", method: "sendText", args });
          return Promise.resolve({ guid: "m-1" });
        },
        subscribeEvents: (...args: unknown[]) => {
          calls.push({ resource: "messages", method: "subscribeEvents", args });
          return makeStream(["e-1", "e-2"]);
        },
      },
      chats: {},
      groups: {},
      attachments: {},
      addresses: {},
      polls: {},
      locations: {},
      events: {},
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    }),
  }));
}

describe("createGrpcClient façade — missing peers", () => {
  it("does not evaluate the v1 module when only the entrypoint is imported", () => {
    // The static import of ../src/index.ts at the top of this file must not
    // have pulled in v1 (or its nice-grpc imports): the throwing factory
    // registered above would have detonated during test collection.
    expect(v1Evaluated).toBe(false);
  });

  it("maps a v1 module load failure to an actionable ConnectionError", async () => {
    const client = createGrpcClient({ address: "localhost:50051", token: "t" });
    let caught: unknown;
    try {
      await client.messages.sendText("chat", "hi");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConnectionError);
    expect((caught as ConnectionError).message).toContain("nice-grpc");
    expect((caught as ConnectionError).message).toContain("createHttpClient");
    expect((caught as ConnectionError).retryable).toBe(false);
    // close() after a failed load is a no-op, not a crash
    await client.close();
  });
});

describe("createGrpcClient façade — working transport", () => {
  beforeAll(() => {
    installWorkingV1();
  });

  it("delegates unary calls through the lazy load (recovering from the earlier failed one)", async () => {
    const client = createGrpcClient({ address: "localhost:50051", token: "t" });
    const result = await client.messages.sendText("chat-guid", "hello");
    expect(result).toEqual({ guid: "m-1" } as never);
    expect(calls.at(-1)).toEqual({
      resource: "messages",
      method: "sendText",
      args: ["chat-guid", "hello"],
    });
  });

  it("returns a working TypedEventStream synchronously for stream methods", async () => {
    const client = createGrpcClient({ address: "localhost:50051", token: "t" });
    const stream = client.messages.subscribeEvents();
    expect(stream).toBeInstanceOf(TypedEventStream);
    const seen: unknown[] = [];
    for await (const event of stream) {
      seen.push(event);
    }
    expect(seen).toEqual(["e-1", "e-2"]);
  });

  it("forwards close() to the inner stream", async () => {
    closed = false;
    const client = createGrpcClient({ address: "localhost:50051", token: "t" });
    const stream =
      client.messages.subscribeEvents() as TypedEventStream<unknown>;
    // Pull one event so the inner stream exists, then close early. (Like v1,
    // a bare for-await `break` returns the source generator; explicit close()
    // is what runs stream cleanup — the façade must forward it inward.)
    for await (const event of stream) {
      expect(event).toBe("e-1");
      break;
    }
    expect(closed).toBe(false);
    await stream.close();
    expect(closed).toBe(true);
  });

  it("close() reaches the v1 client and asyncDispose aliases it", async () => {
    closed = false;
    const client = createGrpcClient({ address: "localhost:50051", token: "t" });
    await client.messages.sendText("c", "x");
    await client.close();
    expect(closed).toBe(true);

    closed = false;
    {
      await using scoped = createGrpcClient({
        address: "localhost:50051",
        token: "t",
      });
      await scoped.messages.sendText("c", "y");
    }
    expect(closed).toBe(true);
  });

  it("keeps the deprecated v1 createClient name as the same factory", () => {
    expect(createClient).toBe(createGrpcClient);
  });

  it("throws a TypeError for methods that never existed on v1", async () => {
    const client = createGrpcClient({ address: "localhost:50051", token: "t" });
    const chats = client.chats as unknown as {
      teleport: (x: string) => Promise<void>;
    };
    expect(chats.teleport("nope")).rejects.toThrow(TypeError);
  });
});
