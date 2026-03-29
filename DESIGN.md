# API Design

TypeScript SDK for [photon-hq/advanced-imessage-server-v2](https://github.com/photon-hq/advanced-imessage-server-v2). This repo is public. The server is private. The `.proto` files vendored here are the single source of truth for the wire protocol.

Inspired by Stripe (auto-pagination, error hierarchy), Vercel AI SDK (streaming result objects), Drizzle (inferred types, `as const`), Hono (multi-runtime), Zod (discriminated unions).

---

## It should feel like this

```ts
import { createClient, directChat, MessageEffect } from "@photon-ai/advanced-imessage";

const im = createClient({ address: "127.0.0.1:50051", token: "..." });

await im.messages.send(directChat("+1234567890"), "Hello!");
```

One import, one line to connect, one line to send. Everything else is opt-in.

---

## Principles

**Simple things are simple. Complex things are possible.** Every API has three tiers:

```ts
// Tier 1 — the 80% case. No options, no config.
await im.messages.send(chat, "Hello!");

// Tier 2 — options object. The 95% case.
await im.messages.send(chat, "Hello!", {
  effect: MessageEffect.confetti,
  replyTo: someGuid,
});

// Tier 3 — builder. When you need multipart, mentions, formatting.
await im.messages.sendComposed(chat,
  MessageBuilder.multipart()
    .addText("Hey ")
    .addMention("@John", "john@icloud.com")
    .withEffect(MessageEffect.slam)
    .build()
);
```

Never force Tier 3 complexity to do a Tier 1 task.

**TypeScript does the work, not the developer.** Branded types prevent swapping a `ChatGuid` for a `MessageGuid` at compile time. Discriminated unions narrow automatically in `if`/`switch`. Overloaded `subscribe()` narrows the event type. The developer writes less, the compiler catches more.

**No magic strings.** Apple's effect IDs (`com.apple.messages.effect.CKConfettiEffect`) are hidden behind `MessageEffect.confetti`. Chat GUID format (`any;-;+1234567890`) is hidden behind `directChat("+1234567890")`. The developer never sees protocol internals.

**Every resource is disposable.** Client, streams, connections — all implement `Symbol.asyncDispose`. No resource leaks. `await using` just works.

**Strict by default.** The codebase compiles under `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`. Generated code must also pass strict. If a codegen tool can't produce strict-clean output, we use a different tool. We never weaken the tsconfig to accommodate generated code.

**Nullable values are handled, not asserted.** Proto response fields come back as `T | undefined`. We use `unwrap(value, "fieldName")` — a typed guard that throws a clear error — instead of non-null assertions (`!`). No `as any`. No `as unknown as T`. If a cast is needed, the abstraction is wrong.

---

## Core Types

### Branded Identifiers

```ts
declare const Brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [Brand]: B };

export type ChatGuid = Brand<string, "ChatGuid">;
export type MessageGuid = Brand<string, "MessageGuid">;
export type AttachmentGuid = Brand<string, "AttachmentGuid">;
```

Zero runtime cost. You cannot pass a `MessageGuid` where a `ChatGuid` is expected. The only way to create one is through constructor functions: `directChat()`, `groupChat()`, `messageGuid()`, `attachmentGuid()`.

### ChatGuid

```ts
directChat("+1234567890")   // ChatGuid: "any;-;+1234567890"
groupChat("chat123")        // ChatGuid: "any;+;chat123"

parseChatGuid(guid)
// -> { type: "direct", address: string, raw: ChatGuid }
// -> { type: "group", identifier: string, raw: ChatGuid }
```

### Enums as `as const` Objects

```ts
export const MessageEffect = {
  slam:         "com.apple.MobileSMS.expressivesend.impact",
  confetti:     "com.apple.messages.effect.CKConfettiEffect",
  fireworks:    "com.apple.messages.effect.CKFireworksEffect",
  balloons:     "com.apple.messages.effect.CKBalloonEffect",
  // ...
} as const;
export type MessageEffect = (typeof MessageEffect)[keyof typeof MessageEffect];
```

Runtime values + full autocomplete + type narrowing. No TS enums. Same for `TextEffect`, `Reaction`.

### `_raw` Escape Hatch

Every domain type has `readonly _raw?: unknown`. When the SDK doesn't surface a field you need, you don't wait for a release — you reach into the proto.

---

## Lists Auto-Paginate

Stolen from Stripe. `list()` returns `Paginated<T>` — both `await`able and `for await`able:

```ts
// First page
const page = await im.messages.list({ chatGuid: chat, limit: 25 });
page.data;   // Message[]
page.meta;   // { total, offset, limit }

// All messages, lazily
for await (const message of im.messages.list({ chatGuid: chat })) {
  console.log(message.text);
}

// Buffered with safety limit
const all = await im.messages.list({ chatGuid: chat }).toArray({ limit: 1000 });
```

```ts
interface Paginated<T> extends AsyncIterable<T>, PromiseLike<PaginatedPage<T>> {
  toArray(options?: { limit?: number }): Promise<T[]>;
}
```

No pagination API to learn. Standard JS iteration handles it.

---

## Events are Discriminated Unions

```ts
type MessageEvent =
  | { type: "message.sent"; message: Message; chatGuid: ChatGuid }
  | { type: "message.received"; message: Message; chatGuid: ChatGuid }
  | { type: "message.updated"; message: Message; updateType: "edited" | "unsent" | "notified" | "reaction" }
  | { type: "message.sendError"; errorCode: string; errorMessage: string };
```

`subscribe()` is overloaded — passing a type string narrows the return:

```ts
// All events
for await (const event of im.messages.subscribe()) { ... }

// Only received — TS knows the exact shape
for await (const event of im.messages.subscribe("message.received")) {
  event.message.text;  // typed, no cast
}
```

`TypedEventStream<T>` supports: `for await`, `.on(cb)`, `.filter()`, `.map()`, `.take(n)`, `Symbol.asyncDispose`.

```ts
const incoming = im.messages.subscribe("message.received")
  .filter(e => e.message.text !== undefined)
  .map(e => ({ from: e.message.sender?.address, text: e.message.text! }));

for await (const { from, text } of incoming) {
  console.log(`[${from}] ${text}`);
}
```

---

## Errors are a Class Hierarchy

`instanceof` over getter booleans. Factory function maps gRPC status + metadata to the right subclass.

```ts
class IMessageError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly grpcCode: number;
}

class AuthenticationError extends IMessageError {}
class NotFoundError extends IMessageError {}
class RateLimitError extends IMessageError {}
class ValidationError extends IMessageError {}
class ConnectionError extends IMessageError {}
```

```ts
try {
  await im.messages.send(chat, "Hello!");
} catch (err) {
  if (err instanceof RateLimitError) { /* back off */ }
  if (err instanceof NotFoundError) { /* chat doesn't exist */ }
  if (err instanceof AuthenticationError) { /* refresh token */ }
}
```

---

## Streaming Downloads

```ts
const dl = await im.attachments.download(guid);
dl.totalBytes;          // known upfront from first chunk
dl.stream;              // ReadableStream<Uint8Array>
await dl.arrayBuffer(); // or just buffer it
```

---

## The Client

```ts
export function createClient(options: ClientOptions): AdvancedIMessage;

interface ClientOptions {
  address: string;
  token: string | (() => Promise<string>);
  tls?: boolean;
  timeout?: number;
  retry?: boolean | RetryOptions;
  autoIdempotency?: boolean;           // auto x-idempotency-key on mutating RPCs
}

interface AdvancedIMessage extends AsyncDisposable {
  readonly messages: Messages;
  readonly chats: Chats;
  readonly groups: Groups;
  readonly attachments: Attachments;
  readonly addresses: Addresses;
  readonly polls: Polls;
  readonly scheduledMessages: ScheduledMessages;
  readonly locations: Locations;
  close(): Promise<void>;
}
```

Factory function returns an interface. The class is an implementation detail.

---

## Proto and Codegen

`proto/photon/imessage/v1/*.proto` — committed, versioned, the contract. `src/generated/` — also committed. Both are checked in so the repo is clone-and-build with no codegen step required.

We use **ts-proto** with `outputServices=nice-grpc,outputServices=generic-definitions`. ts-proto generates:
- Native nice-grpc `ServiceDefinition` objects — no adapter layer
- Typed `ServiceClient` interfaces where unary methods return `Promise<Response>` and streaming methods return `AsyncIterable<Response>` — no wrapper types
- `oneof` fields as plain optional properties — just `if (proto.field)`, no discriminated `oneofKind` ceremony
- `Date` for Timestamp fields — no manual conversion
- Code that compiles under full strict mode

The previous codegen (protobuf-ts) required an adapter to bridge its `ServiceType` to nice-grpc, produced `UnaryCall` wrapper types that needed destructuring, used `oneofKind` discriminated unions that broke under `strict: false`, and couldn't compile with `noUncheckedIndexedAccess`. We switched rather than weakening the tsconfig.

Handwritten types in `src/types/` are the public API. `src/transport/mapper.ts` bridges generated types to public types. Same Mapper pattern the server uses.

### When the server changes

1. Update `.proto` files in this repo
2. `bun run generate`
3. Update mapper + types + resource methods
4. Test, build, ship

---

## What We Don't Do

- **No TS enums** — `as const` objects only
- **No exposed generated types** — handwritten public layer with mappers
- **No `new Class()`** for the entry point — factory functions
- **No query builders** — options objects for reads, builders only for writes
- **No getter booleans on errors** — class hierarchy with `instanceof`
- **No Bun-only APIs** in library code — Web standards only
- **Generated code is committed** — clone-and-build, no codegen step. Proto changes show their TypeScript impact in the diff
- **No raw streams** — result objects with multiple consumption paths
- **No forced complexity** — simple things are always simple
- **No weakened tsconfig** — generated code must compile strict. Pick a different tool if it can't
- **No non-null assertions** — `unwrap()` with a clear error message, not `!`
- **No type casts at the transport boundary** — if the codegen needs `as any` to work with the gRPC library, it's the wrong codegen
