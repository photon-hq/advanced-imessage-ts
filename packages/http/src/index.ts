// biome-ignore-all lint/performance/noBarrelFile: package root is the public HTTP entrypoint.

// Shared public surface (types, errors, streaming, event parsing)
export * from "@photon-ai/aim-core";
// Client
export type {
  AddressesResource,
  AdvancedIMessage,
  AttachmentsResource,
  ChatsResource,
  ClientOptions,
  GroupsResource,
  LocationsResource,
  MessagesResource,
  PollsResource,
} from "./client.ts";
export { createHttpClient } from "./client.ts";
