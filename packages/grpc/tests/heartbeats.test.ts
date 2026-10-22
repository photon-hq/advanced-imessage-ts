import { describe, expect, it, mock } from "bun:test";
import type {
  HeartbeatHandler,
  TypedEventStream,
} from "@photon-ai/aim-core/internal";
import { ChatsResource } from "../src/v1/resources/chats.ts";
import { GroupsResource } from "../src/v1/resources/groups.ts";
import { LocationsResource } from "../src/v1/resources/locations.ts";
import { MessagesResource } from "../src/v1/resources/messages.ts";
import { PollsResource } from "../src/v1/resources/polls.ts";

const chat = "any;-;alice@example.com";
const heartbeat = { heartbeat: {} };
type Rpc = (
  request: unknown,
  options: { signal: AbortSignal }
) => AsyncIterable<unknown>;
type Subscribe = (onHeartbeat?: HeartbeatHandler) => TypedEventStream<unknown>;

const resources: Array<{
  name: string;
  request: unknown;
  create: (rpc: Rpc, fallback: HeartbeatHandler) => Subscribe;
}> = [
  {
    name: "messages",
    request: { chatGuid: chat },
    create: (rpc, fallback) => {
      const resource = new MessagesResource(
        { subscribeMessageEvents: rpc } as never,
        undefined,
        fallback
      );
      return (onHeartbeat) => resource.subscribeEvents({ chat, onHeartbeat });
    },
  },
  {
    name: "chats",
    request: { chatGuid: chat },
    create: (rpc, fallback) => {
      const resource = new ChatsResource(
        { subscribeChatEvents: rpc } as never,
        undefined,
        fallback
      );
      return (onHeartbeat) => resource.subscribeEvents({ chat, onHeartbeat });
    },
  },
  {
    name: "groups",
    request: { chatGuid: chat },
    create: (rpc, fallback) => {
      const resource = new GroupsResource(
        { subscribeGroupEvents: rpc } as never,
        undefined,
        fallback
      );
      return (onHeartbeat) => resource.subscribeEvents({ chat, onHeartbeat });
    },
  },
  {
    name: "polls",
    request: { pollMessageGuid: "poll-1" },
    create: (rpc, fallback) => {
      const resource = new PollsResource(
        { subscribePollEvents: rpc } as never,
        undefined,
        fallback
      );
      return (onHeartbeat) =>
        resource.subscribeEvents({ pollMessage: "poll-1", onHeartbeat });
    },
  },
  {
    name: "locations",
    request: { address: "alice@example.com" },
    create: (rpc, fallback) => {
      const resource = new LocationsResource(
        { watchSharedFriendLocations: rpc } as never,
        undefined,
        fallback
      );
      return (onHeartbeat) =>
        resource.watch("alice@example.com", { onHeartbeat });
    },
  },
];

async function consume(stream: TypedEventStream<unknown>): Promise<unknown[]> {
  const events: unknown[] = [];
  try {
    for await (const event of stream) {
      events.push(event);
    }
    return events;
  } finally {
    await stream.close();
  }
}

for (const resource of resources) {
  describe(`${resource.name} heartbeat`, () => {
    it("uses the subscription hook instead of the client fallback on a quiet stream", async () => {
      const fallback = mock(() => undefined);
      const handler = mock(() => undefined);
      let request: unknown;
      const subscribe = resource.create(async function* (input) {
        request = input;
        yield heartbeat;
        yield heartbeat;
      }, fallback);

      expect(await consume(subscribe(handler))).toEqual([]);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(fallback).not.toHaveBeenCalled();
      expect(request).toEqual(resource.request);
    });

    it("retains the client callback when no subscription hook is set", async () => {
      const fallback = mock(() => undefined);
      const subscribe = resource.create(async function* () {
        yield heartbeat;
      }, fallback);

      expect(await consume(subscribe())).toEqual([]);
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it("does not synthesize heartbeats for empty frames", async () => {
      const fallback = mock(() => undefined);
      const handler = mock(() => undefined);
      const subscribe = resource.create(async function* () {
        yield {};
        yield { sequence: 1 };
      }, fallback);

      expect(await consume(subscribe(handler))).toEqual([]);
      expect(handler).not.toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    it("ignores a late frame after close while a replacement uses its own hook", async () => {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const finished = Promise.withResolvers<void>();
      const fallback = mock(() => undefined);
      const oldHandler = mock(() => undefined);
      const newHandler = mock(() => undefined);
      let first = true;
      let oldSignal: AbortSignal | undefined;
      const subscribe = resource.create(async function* (_request, options) {
        if (first) {
          first = false;
          oldSignal = options.signal;
          started.resolve();
          try {
            // A buffered frame can arrive even after the RPC is aborted.
            await release.promise;
            yield heartbeat;
          } finally {
            finished.resolve();
          }
          return;
        }
        yield heartbeat;
      }, fallback);
      const old = subscribe(oldHandler);
      const pending = old[Symbol.asyncIterator]().next();
      try {
        await started.promise;
        await old.close();
        expect(oldSignal?.aborted).toBe(true);
        expect((await pending).done).toBe(true);
        expect(await consume(subscribe(newHandler))).toEqual([]);
      } finally {
        await old.close();
        release.resolve();
        await finished.promise;
      }
      expect(oldHandler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalledTimes(1);
      expect(fallback).not.toHaveBeenCalled();
    });
  });
}

it("does not let a sibling heartbeat mask paused message processing", async () => {
  const fallback = mock(() => undefined);
  const messageHeartbeat = mock(() => undefined);
  const pollHeartbeat = mock(() => undefined);
  const messages = new MessagesResource(
    {
      async *subscribeMessageEvents() {
        yield {
          sequence: 1,
          messageChanged: {
            chatGuid: chat,
            occurredAt: new Date(0),
            isFromMe: false,
            messageRead: { messageGuid: "message-1", readAt: new Date(0) },
          },
        };
        yield heartbeat;
      },
    } as never,
    undefined,
    fallback
  );
  const polls = new PollsResource(
    {
      async *subscribePollEvents() {
        yield heartbeat;
      },
    } as never,
    undefined,
    fallback
  );
  const stream = messages.subscribeEvents({ onHeartbeat: messageHeartbeat });
  const iterator = stream[Symbol.asyncIterator]();
  try {
    expect((await iterator.next()).value?.type).toBe("message.read");
    // The message consumer is still processing: it has not requested another frame.
    await consume(polls.subscribeEvents({ onHeartbeat: pollHeartbeat }));
    expect(pollHeartbeat).toHaveBeenCalledTimes(1);
    expect(messageHeartbeat).not.toHaveBeenCalled();
    expect((await iterator.next()).done).toBe(true);
    expect(messageHeartbeat).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  } finally {
    await stream.close();
  }
});
