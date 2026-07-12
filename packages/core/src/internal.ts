// biome-ignore-all lint/performance/noBarrelFile: internal surface consumed only by the sibling transport packages, never published.

/**
 * Everything the transport packages need from core, public and internal
 * alike: domain types, error classes, the proto↔public mapper, service-client
 * aliases, and small utilities. The published package never re-exports this
 * module — the curated public surface lives in `index.ts`.
 */

export * from "./errors/imessage-error.ts";
export * from "./errors/to-imessage-error.ts";
export * from "./events/parse.ts";
export * from "./mapper.ts";
export * from "./service-clients.ts";
export * from "./streaming/event-stream.ts";
export * from "./types/addresses.ts";
export * from "./types/attachments.ts";
export * from "./types/chat-guid.ts";
export * from "./types/chats.ts";
export * from "./types/common.ts";
export * from "./types/effects.ts";
export * from "./types/enums.ts";
export * from "./types/errors.ts";
export * from "./types/events.ts";
export * from "./types/groups.ts";
export * from "./types/locations.ts";
export * from "./types/messages.ts";
export * from "./types/polls.ts";
export * from "./utils/idempotency.ts";
export * from "./utils/retry.ts";
export * from "./utils/sleep.ts";
export * from "./utils/unwrap.ts";
