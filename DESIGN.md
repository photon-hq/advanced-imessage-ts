# API Design

TypeScript SDK for [photon-hq/advanced-imessage-server-v2](https://github.com/photon-hq/advanced-imessage-server-v2). This repo is public. The server is private. The vendored `.proto` files are the wire contract.

---

## It should feel like this

```ts
import { createClient, MessageEffect } from "@photon-ai/advanced-imessage";

const im = createClient({ address: "127.0.0.1:50051", token: "..." });

await im.messages.sendText("any;-;+1234567890", "Hello!");
```

One import, one line to connect, one line to send. Everything else is opt-in.

---

## Principles

**Follow the server contract.** Resource methods mirror the v2 service/RPC shape:

```ts
await im.messages.sendText(chat, "Hello!");

await im.messages.sendText(chat, "Hello!", {
  effect: MessageEffect.confetti,
  replyTo: someGuid,
});

await im.messages.sendMultipart(chat, [
  { text: "Hey " },
  { text: "@John", mentionedAddress: "john@icloud.com" },
]);
```

The handwritten layer should map TypeScript-friendly parameters to proto
fields, map proto responses back to public result types, and translate
transport errors. It should not add alternate workflows on top of server
behavior.

**TypeScript does the work, not the developer.** Discriminated unions narrow automatically in `if`/`switch`. Explicit stream methods keep each event domain narrow by construction. The developer writes less, the compiler catches more.

**Keep protocol rules documented and enforced at the boundary.** Apple's effect IDs (`com.apple.messages.effect.CKConfettiEffect`) are hidden behind `MessageEffect.confetti`. Chat GUIDs stay plain strings for API simplicity, but the SDK validates them before sending.

**Lifecycle is explicit.** The client owns the gRPC channel and implements
`Symbol.asyncDispose`. Streams also implement `Symbol.asyncDispose`. Resource
namespaces are thin method groups and do not own sockets.

**Strict by default.** The codebase compiles under `strict: true`,
`noUncheckedIndexedAccess`, `noImplicitOverride`, and `verbatimModuleSyntax`.
Generated code must also pass strict.

**Nullable values are handled, not asserted.** Proto response fields come back as `T | undefined`. We use `unwrap(value, "fieldName")` — a typed guard that throws a clear error — instead of non-null assertions (`!`). Handwritten source should not need `as any` or `as unknown as T` at the transport boundary. If a production cast is needed there, the abstraction is wrong.

---

## Core Types

### ChatGuid

```ts
"any;-;+1234567890"
"any;+;chat123"
```

Public methods keep `chat` as a plain `string`. The rule lives in docs and
JSDoc: `chat` must already be a structured chat guid such as
`"any;-;alice@example.com"` or `"any;+;chat123"`. The SDK validates that at
the boundary instead of trying to guess caller intent from arbitrary strings.

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

Runtime values + full autocomplete + type narrowing. No TS enums. Same for `TextEffect`.

## Events are Discriminated Unions

```ts
type MessageEvent =
  | { type: "message.received"; sequence: number; message: Message; chatGuid: string }
  | { type: "message.edited"; sequence: number; messageGuid: string; chatGuid: string }
  | { type: "message.read"; sequence: number; messageGuid: string; chatGuid: string }
  | { type: "message.unsent"; sequence: number; messageGuid: string; chatGuid: string }
  | { type: "message.reactionAdded"; sequence: number; messageGuid: string; chatGuid: string }
  | { type: "message.reactionRemoved"; sequence: number; messageGuid: string; chatGuid: string }
  | { type: "message.stickerPlaced"; sequence: number; messageGuid: string; chatGuid: string };
```

Every live event carries a monotonic global `sequence` shared with
`events.catchUp(...)`.

Message streams stay explicit at the resource boundary:

```ts
// All events
for await (const event of im.messages.subscribeEvents()) {
  if (event.type === "message.received") {
    event.message.content.text;  // typed after narrowing, no cast
  }
}
```

`TypedEventStream<T>` supports: `for await`, `.on(cb)`, `.filter()`, `.map()`, `.take(n)`, `Symbol.asyncDispose`.

```ts
const incoming = im.messages.subscribeEvents()
  .filter(
    (e): e is Extract<typeof e, { type: "message.received" }> =>
      e.type === "message.received" && e.message.content.text !== undefined
  )
  .map(e => ({ from: e.message.sender?.address, text: e.message.content.text! }));

for await (const { from, text } of incoming) {
  console.log(`[${from}] ${text}`);
}
```

---

## Stream Catch-Up

When a stream disconnects, events can keep arriving on the server. The SDK
exposes explicit sequence-based catch-up; it does not hide a reconnect loop
inside live streams.

```ts
let since = loadPersistedSequence(); // your storage

// 1. Drain missed durable events.
for await (const event of im.events.catchUp(since)) {
  if (event.type === "catchup.complete") {
    since = event.headSequence;
    break;
  }

  processEvent(event);
  since = event.sequence;
}

// 2. Resume live streams and keep persisting the latest sequence.
for await (const event of im.messages.subscribeEvents()) {
  processEvent(event);
  since = event.sequence;
  persistSequence(since);
}
```

`catchUp(since)` yields durable events where `event.sequence > since`, then a
terminal `catchup.complete` frame with the current `headSequence`. Persist the
last event sequence you have fully handled.

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
  await im.messages.sendText(chat, "Hello!");
} catch (err) {
  if (err instanceof RateLimitError) { /* back off */ }
  if (err instanceof NotFoundError) { /* chat doesn't exist */ }
  if (err instanceof AuthenticationError) { /* refresh token */ }
}
```

---

## Streaming Downloads

```ts
for await (const frame of im.attachments.downloadStream(guid)) {
  if (frame.type === "header") {
    frame.info.totalBytes;
  }
  if (frame.type === "primaryChunk") {
    frame.data;
  }
}
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
  readonly locations: Locations;
  close(): Promise<void>;
}
```

Factory function returns an interface. The class is an implementation detail.

---

## Proto and Codegen

The contract is the BSR module [`buf.build/photon-hq/imessage`](https://buf.build/photon-hq/imessage),
published by advanced-imessage-server-v2's CI (the canonical home — this repo never pushes it and
vendors no protos; `buf generate` pulls the module from the BSR, pinned to a specific module commit
in `buf.gen.yaml` for reproducibility). `packages/core/src/generated/` is committed so the repo is
clone-and-build with no codegen step required, and CI fails if it drifts from the pin.

We use **ts-proto** with `outputServices=nice-grpc,outputServices=generic-definitions`. ts-proto generates:
- Native nice-grpc `ServiceDefinition` objects
- Typed `ServiceClient` interfaces where unary methods return `Promise<Response>` and streaming methods return `AsyncIterable<Response>`
- `oneof` fields as plain optional properties
- `Date` for Timestamp fields — no manual conversion
- Code that compiles under full strict mode

Handwritten types in `packages/core/src/types/` are the public API. `packages/core/src/mapper.ts` bridges generated types to public types. Same Mapper pattern the server uses.

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
- **No query builders** — direct methods plus small options objects
- **No getter booleans on errors** — class hierarchy with `instanceof`
- **No Bun-only APIs** in library code — Web standards only
- **Generated code is committed** — clone-and-build, no codegen step. Proto changes show their TypeScript impact in the diff
- **No hidden reconnect loops** — streams are explicit `TypedEventStream`s; use
  `events.catchUp(sequence)` for recovery
- **No forced complexity** — simple things are always simple
- **No weakened tsconfig** — generated code must compile strict. Pick a different tool if it can't
- **No non-null assertions** — `unwrap()` with a clear error message, not `!`
- **No type casts at the transport boundary** — if the codegen needs `as any` to work with the gRPC library, it's the wrong codegen
