---
name: typescript-sdk-dx
description: >-
  TypeScript SDK design patterns for @photon-ai/advanced-imessage.
  Use when writing or modifying SDK code: types, resources, transport,
  streaming, errors, builders, or the public API surface. Covers branded
  types, progressive disclosure, auto-pagination, error hierarchies,
  event streaming, codegen, and build tooling.
compatibility: Designed for Codex (or similar products)
metadata:
  author: photon-hq
  version: "1.0"
  learned-from: Stripe, Vercel AI SDK, Drizzle, ElysiaJS, Hono, Zod, tRPC
---

# TypeScript SDK DX Patterns

Hard-won patterns from building this SDK and studying the best TypeScript libraries. These are the rules — not guidelines. If you're about to break one, stop and reconsider the abstraction.

## The Rules

### 1. Factory functions, not classes

`createClient()` returns an interface. The implementation is hidden. This is the modern TS idiom.

Exception: error classes use real classes for `instanceof`.

### 2. `as const` objects, not TS enums

Every enum-like value is an `as const` object with a matching type alias. Runtime values + autocomplete + type narrowing. No reverse mapping bugs, no tree-shaking issues.

### 3. Branded types for identifiers

`ChatGuid`, `MessageGuid`, `AttachmentGuid` are phantom-branded strings. You cannot swap them. Constructor functions are the only way in. Never export a raw cast.

### 4. Progressive disclosure (three tiers)

Every API: one-liner -> options object -> builder. Never force tier 3 complexity for a tier 1 task. Builders only for write-side composition where combinatorics justify them. Options objects for reads.

### 5. Auto-paginating lists

`list()` returns `Paginated<T>` — both `PromiseLike` and `AsyncIterable`. `await` for first page, `for await` for all items, `.toArray()` for buffered. No pagination API to learn.

### 6. Error class hierarchy

`IMessageError` base with `AuthenticationError`, `NotFoundError`, `RateLimitError`, `ValidationError`, `ConnectionError` subclasses. `instanceof` over getter booleans. Factory function in transport layer maps gRPC status to the right subclass.

### 7. Discriminated unions for events

`type` string literals as discriminators. `subscribe()` overloaded to narrow the return type. `TypedEventStream<T>` supports `for await`, `.on()`, `.filter()`, `.map()`, `.take()`, `Symbol.asyncDispose`.

### 8. Handwritten types over generated types

`src/types/` is the public API. `src/transport/mapper.ts` bridges generated -> public. Generated types have wrong shapes (numeric enums, verbose names, no brands). We wrap them, never expose them.

### 9. Strict by default

`strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`. Generated code must also pass. If a codegen tool can't produce strict-clean output, use a different tool. Never weaken the tsconfig.

### 10. No non-null assertions

Use `unwrap(value, "fieldName")` — a typed guard that throws a clear error. No `!`, no `as any`, no `as unknown as T`. If a cast is needed, the abstraction is wrong.

### 11. Generated code is committed

Both `.proto` files and `src/generated/` are in git. Clone-and-build with no codegen step. Proto changes show their TypeScript impact in the diff.

### 12. ts-proto for codegen

ts-proto with `outputServices=nice-grpc,outputServices=generic-definitions` generates native nice-grpc service definitions, typed clients with `Promise<Response>` returns, `AsyncIterable` for streaming, and `Date` for timestamps. No adapter layers, no wrapper types, no casts.

### 13. Every resource is disposable

Client and streams implement `Symbol.asyncDispose`. `close()` and `[Symbol.asyncDispose]()` are the same operation. `await using` just works.

### 14. No magic strings

Apple's effect IDs hidden behind `MessageEffect.confetti`. Chat GUID format hidden behind `directChat()`. Protocol internals never leak to the developer.

### 15. Web standards only

No Bun-only APIs in library code. `ReadableStream`, `Uint8Array`, `crypto.randomUUID()`. Bun-first for scripts and tests, Node-compatible for the library.

## Reference Material

See [patterns](references/patterns.md) for detailed code examples and rationale for each rule.
