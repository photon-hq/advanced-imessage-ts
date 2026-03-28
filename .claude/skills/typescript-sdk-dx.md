# TypeScript SDK DX Patterns

Hard-won patterns from studying the best TypeScript SDKs (Vercel AI SDK, Stripe, Drizzle, ElysiaJS, Hono, Zod, tRPC). Apply these when building or modifying this SDK.

---

## Factory Functions Over Classes

Use `createClient()` / `createX()` instead of `new Class()`.

**Why**: Returns an interface, hides implementation, tree-shakeable, allows internal refactoring without breaking consumers. This is the modern TS idiom — tRPC, Drizzle, Hono, Vercel AI SDK all do this.

```ts
// Good
export function createClient(options: ClientOptions): AdvancedIMessage;

// Avoid
export class AdvancedIMessage { constructor(options: ClientOptions) {} }
```

**Exception**: Error classes should be real classes (for `instanceof` checks).

---

## `as const` Objects Over TypeScript Enums

Use `as const` objects with a matching type alias to get both runtime values AND type narrowing.

**Why**: TS enums have quirks (reverse mapping, numeric enums, tree-shaking issues). `as const` gives you: autocomplete, runtime access, iterable keys/values, and proper type narrowing. Zod and Drizzle both use this pattern.

```ts
// Good
export const MessageEffect = {
  slam: "com.apple.MobileSMS.expressivesend.impact",
  confetti: "com.apple.messages.effect.CKConfettiEffect",
} as const;
export type MessageEffect = (typeof MessageEffect)[keyof typeof MessageEffect];

// Avoid
export enum MessageEffect {
  Slam = "com.apple.MobileSMS.expressivesend.impact",
}
```

---

## Branded Types for Identifier Safety

Use phantom brands to prevent accidentally swapping identifiers like ChatGuid and MessageGuid. Zero runtime cost.

```ts
declare const Brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [Brand]: B };

export type ChatGuid = Brand<string, "ChatGuid">;
export type MessageGuid = Brand<string, "MessageGuid">;
```

Provide constructor functions (`chatGuid()`, `directChat()`, `messageGuid()`) as the only way to create branded values. Never export a raw cast.

---

## Progressive Disclosure (Three Levels)

Every API should have three complexity tiers:

1. **One-liner**: The 80% case. Minimal arguments, smart defaults.
2. **Options object**: The 95% case. Optional fields for customization.
3. **Builder/Advanced**: The 100% case. Full power when needed.

```ts
// Level 1
await im.messages.send(chat, "Hello!");

// Level 2
await im.messages.send(chat, "Hello!", { effect: MessageEffect.confetti });

// Level 3
await im.messages.sendComposed(chat, MessageBuilder.multipart()...build());
```

**Rule**: Never force the developer to use Level 3 complexity to do a Level 1 task.

---

## Auto-Paginating Lists (Stripe Pattern)

Any method that returns a list should return a `Paginated<T>` that is BOTH `await`able (for a single page) AND `for await`able (for auto-pagination).

```ts
export interface Paginated<T> extends AsyncIterable<T>, PromiseLike<PaginatedPage<T>> {
  toArray(options?: { limit?: number }): Promise<T[]>;
}
```

**Why**: This is the Stripe gold standard. The developer gets three consumption patterns without learning a pagination API:
- `await list()` — first page
- `for await (const item of list())` — all items, lazy
- `list().toArray({ limit: 1000 })` — all items, buffered

---

## Error Class Hierarchy (Stripe Pattern)

Use a base error class with subclasses for common cases. Use a factory function internally to construct the right subclass from server responses.

```ts
export class IMessageError extends Error { /* base */ }
export class AuthenticationError extends IMessageError {}
export class NotFoundError extends IMessageError {}
export class RateLimitError extends IMessageError {}
export class ValidationError extends IMessageError {}
export class ConnectionError extends IMessageError {}
```

**Why**: `instanceof` is the idiomatic JS error-handling pattern. It's cleaner than checking `.code` or `.isRateLimited` getters. Stripe, Vercel AI SDK, and Zod all use this.

**Rule**: The factory function (`fromGrpcError()`) lives in the transport layer. Resource methods never construct errors directly.

---

## Discriminated Unions for Events

Use `type` string literals as discriminators. Never use numeric codes or boolean flags.

```ts
export type MessageEvent =
  | { type: "message.sent"; message: Message; chatGuid: ChatGuid }
  | { type: "message.received"; message: Message; chatGuid: ChatGuid }
  | { type: "message.updated"; message: Message; updateType: "edited" | "unsent" }
  | { type: "message.sendError"; errorCode: string; errorMessage: string };
```

**Why**: TypeScript narrows discriminated unions in `if`/`switch` automatically. The developer gets full autocomplete after checking `event.type`.

Use `Extract<Union, { type: T }>` for type-safe filtering.

---

## Streaming: Result Objects With Multiple Consumption Paths (Vercel AI SDK Pattern)

A streaming API should return a result object that supports multiple consumption patterns, not a raw stream.

```ts
// TypedEventStream supports:
stream[Symbol.asyncIterator]()      // for await...of
stream.on(callback)                  // callback style
stream.filter(predicate)             // narrowed sub-stream
stream.map(transform)                // transformed stream
stream.take(n)                       // first N events
stream[Symbol.asyncDispose]()        // cleanup
```

**Why**: Different use cases need different patterns. A bot wants `for await`. A UI wants callbacks. A processor wants `.filter().map()`. Let the developer choose.

---

## `_raw` Escape Hatch

Every public domain type should include `readonly _raw: GeneratedProtoType`. This lets power users access the full proto message (50+ fields) without waiting for SDK updates when they need an obscure field.

**Rule**: `_raw` is typed as the generated proto type, not `unknown`. Power users get autocomplete on it too.

---

## Handwritten Types Over Re-exported Generated Types

Generated proto types have poor DX: `BigInt` instead of `number`, flat `Timestamp` instead of `Date`, verbose names, no branded identifiers. Always write a clean public type layer (`src/types/`) and bridge with mappers (`src/transport/mapper.ts`).

This is the same Mapper pattern the server uses (Domain types vs Proto types).

---

## Builders Only for Write-Side Composition

Use builders (fluent chaining) only when the combinatorics justify them — typically write operations with many optional parts (multipart messages with formatting, mentions, effects, stickers).

For read operations (queries, list filters), use plain options objects. They're more discoverable, easier to type, and work better with spread/merge.

```ts
// Write: Builder justified (many combinable parts)
MessageBuilder.multipart().addText("Hi ").addMention("@John", "j@me.com").bold(0, 2).build()

// Read: Options object (simple filter)
im.messages.list({ chatGuid: chat, before: date, limit: 50 })
```

---

## `await using` / Symbol.asyncDispose Everywhere

Any resource that holds a connection or stream should implement `AsyncDisposable`. This includes the client itself and event streams.

```ts
await using im = createClient({ ... });
await using stream = im.messages.subscribe();
```

**Rule**: `close()` and `[Symbol.asyncDispose]()` should be the same operation. Never require the developer to remember both.

---

## Multi-Runtime Package Exports

Use conditional exports in `package.json` for Bun, Node, and standard ESM:

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

**Rule**: No Bun-only APIs in library code. Use Web standards (`ReadableStream`, `Uint8Array`, `crypto.randomUUID()`). Bun-specific optimizations only in conditional export paths if needed later.

---

## tsup for Building

Use tsup (not raw `tsc` or `bun build`):
- Generates `.d.ts` + ESM + sourcemaps in one step
- `dts: true` handles declaration bundling
- `treeshake: true` for smaller output
- Used by Vercel AI SDK, Drizzle, and hundreds of TS packages

---

## Idempotency Keys

Auto-generate `x-idempotency-key` headers for mutating RPCs (sends, creates, votes). Use `crypto.randomUUID()`. Let the developer override with `clientMessageId` in options.

**Why**: Prevents double-sends on network retries. The server deduplicates within a TTL window. The developer should never have to think about this.

---

## Proto Workflow

- `.proto` files in `proto/` are the source of truth (committed)
- Generated TS in `src/generated/` is gitignored (regenerated via `bun run generate`)
- `buf.gen.yaml` with `@protobuf-ts/plugin` for nice-grpc compatibility
- `long_type_number` option to avoid BigInt
- When server adds RPCs: update proto -> regenerate -> add mapper -> add type -> add resource method

---

## What NOT To Do

- **Don't use TS enums** — use `as const` objects
- **Don't expose generated proto types** — wrap them in clean public types
- **Don't use `new Class()`** for the main entry point — use factory functions
- **Don't build query builders** — options objects are better for reads
- **Don't use getter booleans for errors** (`.isNotFound`) — use class hierarchy + `instanceof`
- **Don't require Bun-specific APIs** — stay on Web standards
- **Don't bundle generated code in git** — gitignore it, regenerate on build
- **Don't return raw streams** — wrap in result objects with multiple consumption paths
- **Don't force complexity** — progressive disclosure always. Simple things must be simple.
