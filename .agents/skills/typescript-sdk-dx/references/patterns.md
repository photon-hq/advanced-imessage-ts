# Pattern Reference

Detailed code examples and rationale for each SDK design rule.

## Factory Functions

```ts
// Good — returns interface, hides implementation
export function createClient(options: ClientOptions): AdvancedIMessage;

// Bad — exposes class, can't change internals without breaking consumers
export class AdvancedIMessage { constructor(options: ClientOptions) {} }
```

Why: tree-shakeable, allows internal refactoring, modern TS idiom (tRPC, Drizzle, Hono).

## `as const` Objects

```ts
export const MessageEffect = {
  slam: "com.apple.MobileSMS.expressivesend.impact",
  confetti: "com.apple.messages.effect.CKConfettiEffect",
} as const;
export type MessageEffect = (typeof MessageEffect)[keyof typeof MessageEffect];
```

Why: TS enums have reverse mapping, numeric quirks, tree-shaking issues. `as const` gives autocomplete, runtime values, iterable keys, and proper narrowing.

## Branded Types

```ts
declare const Brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [Brand]: B };

export type ChatGuid = Brand<string, "ChatGuid">;
export type MessageGuid = Brand<string, "MessageGuid">;
```

Constructor functions are the only entry point:
```ts
export function directChat(address: string): ChatGuid {
  return `any;-;${address}` as ChatGuid;
}
```

## Progressive Disclosure

```ts
// Tier 1 — one-liner (80% case)
await im.messages.send(chat, "Hello!");

// Tier 2 — options object (95% case)
await im.messages.send(chat, "Hello!", { effect: MessageEffect.confetti });

// Tier 3 — builder (100% case, multipart/mentions/formatting)
await im.messages.sendComposed(chat, MessageBuilder.multipart()
  .addText("Hey ").addMention("@John", "j@me.com").bold(0, 3).build());
```

Builders for writes (combinatorics justify them). Options objects for reads (simpler, more discoverable).

## Auto-Paginating Lists

```ts
interface Paginated<T> extends AsyncIterable<T>, PromiseLike<PaginatedPage<T>> {
  toArray(options?: { limit?: number }): Promise<T[]>;
}
```

Three consumption patterns, zero API to learn:
- `await list()` — first page
- `for await (const item of list())` — all items lazily
- `list().toArray({ limit: 1000 })` — buffered

## Error Hierarchy

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

Factory function `fromGrpcError()` lives in transport layer. Resources never construct errors directly. `instanceof` is the check pattern.

## Event Streaming

```ts
type MessageEvent =
  | { type: "message.sent"; message: Message; chatGuid: ChatGuid }
  | { type: "message.received"; message: Message; chatGuid: ChatGuid }
  | { type: "message.updated"; message: Message; updateType: "edited" | "unsent" }
  | { type: "message.sendError"; errorCode: string; errorMessage: string };
```

`subscribe()` overloaded to narrow:
```ts
im.messages.subscribe("message.received")  // TypedEventStream<Extract<MessageEvent, { type: "message.received" }>>
```

`TypedEventStream<T>` supports: `for await`, `.on(cb)`, `.filter()`, `.map()`, `.take(n)`, `Symbol.asyncDispose`.

## Nullable Handling

```ts
// Good — typed guard with clear error
function unwrap<T>(value: T | undefined | null, field: string): T {
  if (value == null) throw new Error(`Expected ${field} in response`);
  return value;
}
const chat = unwrap(response.chat, "chat");

// Bad — silent assertion
const chat = response.chat!;
```

## Codegen: protoc-gen-es (Connect-ES v2)

```yaml
# buf.gen.yaml
plugins:
  - local: protoc-gen-es
    out: src/generated
    opt:
      - target=ts
      - import_extension=.js
      - json_types=false
```

protoc-gen-es generates:
- Service descriptors (`MessageService`, …) — consumed by Connect's `createClient`
- `Promise<Response>` for unary, `AsyncIterable<Response>` for streaming — no wrapper types
- `oneof` as discriminated unions — `switch (proto.field.case)`, narrowed `.value`
- `Timestamp` as a message and 64-bit fields as `bigint` — the mapper converts to `Date` / `number`
- Strict-clean output — compiles under full strict mode

The transport is Connect grpc-web (`@connectrpc/connect-web`) over `fetch`, so the SDK runs in browsers and Node 18+, typically fronted by an Envoy grpc-web proxy. The mapper (`src/transport/mapper.ts`) bridges generated shapes to the handwritten public types; requests are built as plain init-shape objects.

## Build

tsup for ESM + `.d.ts` + sourcemaps in one step. `dts: true` handles declaration bundling. Single strict `tsconfig.json` — no separate build config with relaxed settings.

## Package Exports

```jsonc
{
  "exports": {
    ".": {
      "bun": "./dist/index.js",
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

No Bun-only APIs in library code. Web standards only.
