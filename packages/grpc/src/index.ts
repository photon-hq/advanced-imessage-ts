// biome-ignore-all lint/performance/noBarrelFile: package root is the public gRPC entrypoint.

/**
 * The gRPC entrypoint: v1's full surface behind a lazy façade.
 *
 * The root package entry re-exports {@link createGrpcClient}, so this module
 * is evaluated by every consumer — including fetch-only runtimes that will
 * never use gRPC. Nothing here may statically import `nice-grpc` (an
 * optional peer): the v1 implementation loads through a dynamic import that
 * only runs once a client is created, and failures surface as a
 * `ConnectionError` telling the caller which peers to install.
 *
 * The factory stays synchronous (v1's `createClient` was): resources are
 * thin proxies that delegate through the pending module load. Every v1
 * resource method was already async or already returned a `TypedEventStream`
 * synchronously, so the laziness is behavior-transparent.
 */

import {
  ConnectionError,
  TypedEventStream,
} from "@photon-ai/aim-core/internal";
import type { AdvancedIMessage, ClientOptions } from "./v1/client.ts";

// Shared public surface (types, errors, streaming, event parsing) — the
// `/grpc` subpath is self-sufficient, like the v1 package root was.
export * from "@photon-ai/aim-core";
export type { HeartbeatHandler } from "@photon-ai/aim-core/internal";
// v1 type surface (type-only: erased at build, so no nice-grpc evaluation)
export type {
  AddressesResource,
  AdvancedIMessage,
  AttachmentsResource,
  ChatsResource,
  ClientOptions,
  EventsResource,
  GroupsResource,
  LocationsResource,
  MessagesResource,
  PollsResource,
} from "./v1/client.ts";
export type { GrpcChannelOptions } from "./v1/transport/grpc-client.ts";

type V1Module = typeof import("./v1/client.ts");

const PEER_HINT =
  '`createGrpcClient` needs the optional peer dependencies of "@photon-ai/advanced-imessage": ' +
  "nice-grpc, nice-grpc-common, and @grpc/grpc-js.\n" +
  "Install them:  bun add nice-grpc nice-grpc-common @grpc/grpc-js\n" +
  "The gRPC transport is legacy; new code should use `createHttpClient`, " +
  "which needs no extra installs.";

const GRPC_STATUS_UNAVAILABLE = 14;

function missingPeersError(cause: unknown): ConnectionError {
  return new ConnectionError(PEER_HINT, {
    cause: cause instanceof Error ? cause : undefined,
    code: "internalError",
    context: {},
    grpcCode: GRPC_STATUS_UNAVAILABLE,
    retryable: false,
  });
}

let modulePromise: Promise<V1Module> | undefined;

function loadV1(): Promise<V1Module> {
  modulePromise ??= import("./v1/client.ts").catch((cause: unknown) => {
    // Reset so installing the peers mid-process recovers on the next call.
    modulePromise = undefined;
    throw missingPeersError(cause);
  });
  return modulePromise;
}

/**
 * Best-effort synchronous preflight: on runtimes with `import.meta.resolve`
 * (Bun, Node ≥ 20.6) a missing peer fails at factory time instead of on the
 * first call.
 */
function assertPeersResolvable(): void {
  const meta = import.meta as { resolve?: (specifier: string) => string };
  if (typeof meta.resolve !== "function") {
    return;
  }
  try {
    for (const peer of ["nice-grpc", "nice-grpc-common", "@grpc/grpc-js"]) {
      meta.resolve(peer);
    }
  } catch (cause) {
    throw missingPeersError(cause);
  }
}

type ResourceKey = Exclude<keyof AdvancedIMessage, keyof AsyncDisposable>;

const NO_STREAMS: ReadonlySet<string> = new Set();

/** v1 methods that synchronously return a `TypedEventStream`. */
const STREAM_METHODS: Readonly<
  Partial<Record<ResourceKey, ReadonlySet<string>>>
> = {
  attachments: new Set(["downloadStream"]),
  chats: new Set(["subscribeEvents"]),
  events: new Set(["catchUp"]),
  groups: new Set(["subscribeEvents"]),
  locations: new Set(["watch"]),
  messages: new Set(["subscribeEvents"]),
  polls: new Set(["subscribeEvents"]),
};

function invokeMember(
  target: object,
  key: string,
  prop: string,
  args: readonly unknown[]
): unknown {
  const member: unknown = Reflect.get(target, prop);
  if (typeof member !== "function") {
    throw new TypeError(`${key}.${prop} is not a method`);
  }
  return member.apply(target, args);
}

function lazyStream(
  client: Promise<AdvancedIMessage>,
  key: ResourceKey,
  prop: string,
  args: readonly unknown[]
): TypedEventStream<unknown> {
  let inner: TypedEventStream<unknown> | undefined;
  async function* run(): AsyncGenerator<unknown, void, undefined> {
    const resource: object = (await client)[key];
    inner = invokeMember(
      resource,
      key,
      prop,
      args
    ) as TypedEventStream<unknown>;
    yield* inner;
  }
  return new TypedEventStream(run(), async () => {
    if (inner) {
      await inner.close();
    }
  });
}

function lazyResource<T extends object>(
  client: Promise<AdvancedIMessage>,
  key: ResourceKey,
  streamMethods: ReadonlySet<string>
): T {
  const methods = new Map<string, (...args: unknown[]) => unknown>();
  // The proxy target is empty on purpose: every member materializes on first
  // access, delegating through the pending v1 module load.
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then") {
        return undefined;
      }
      let method = methods.get(prop);
      if (!method) {
        method = streamMethods.has(prop)
          ? (...args: unknown[]) => lazyStream(client, key, prop, args)
          : (...args: unknown[]) =>
              client.then((c) => invokeMember(c[key], key, prop, args));
        methods.set(prop, method);
      }
      return method;
    },
  });
}

/**
 * Creates an Advanced iMessage client on the legacy gRPC transport (the v1
 * SDK surface, including `events` and the live `subscribeEvents`/`watch`
 * streams).
 *
 * Requires the optional peer dependencies `nice-grpc`, `nice-grpc-common`,
 * and `@grpc/grpc-js`. Node/Bun only — fetch-only runtimes (Cloudflare
 * Workers) should use `createHttpClient`.
 */
export function createGrpcClient(options: ClientOptions): AdvancedIMessage {
  assertPeersResolvable();
  const client = loadV1().then((m) => m.createClient(options));
  // A missing-peer failure surfaces on the first call; don't let the eager
  // load also trigger an unhandled rejection.
  client.catch(() => undefined);

  async function close(): Promise<void> {
    const c = await client.catch(() => undefined);
    if (c) {
      await c.close();
    }
  }

  return {
    addresses: lazyResource(client, "addresses", NO_STREAMS),
    attachments: lazyResource(
      client,
      "attachments",
      STREAM_METHODS.attachments ?? NO_STREAMS
    ),
    chats: lazyResource(client, "chats", STREAM_METHODS.chats ?? NO_STREAMS),
    events: lazyResource(client, "events", STREAM_METHODS.events ?? NO_STREAMS),
    groups: lazyResource(client, "groups", STREAM_METHODS.groups ?? NO_STREAMS),
    locations: lazyResource(
      client,
      "locations",
      STREAM_METHODS.locations ?? NO_STREAMS
    ),
    messages: lazyResource(
      client,
      "messages",
      STREAM_METHODS.messages ?? NO_STREAMS
    ),
    polls: lazyResource(client, "polls", STREAM_METHODS.polls ?? NO_STREAMS),
    close,
    async [Symbol.asyncDispose](): Promise<void> {
      await close();
    },
  };
}

/**
 * @deprecated v1 alias — `createClient` from `@photon-ai/advanced-imessage`
 * v1 maps to this. Use {@link createGrpcClient}, or migrate to
 * `createHttpClient` on the root / `/http` entrypoints.
 */
export const createClient = createGrpcClient;
