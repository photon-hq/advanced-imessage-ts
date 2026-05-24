/**
 * Creates and configures the nice-grpc channel and all service clients.
 *
 * This module is the single entry point for establishing a gRPC connection.
 * It wires up channel creation, auth middleware, optional idempotency
 * middleware, and returns typed clients for every service defined in the
 * proto contract.
 */

import {
  type Channel,
  ChannelCredentials,
  createChannel,
  createClientFactory,
} from "nice-grpc";
import type { AddressServiceClient } from "../generated/photon/imessage/v1/address_service.ts";
import { AddressServiceDefinition } from "../generated/photon/imessage/v1/address_service.ts";
import type { AttachmentServiceClient } from "../generated/photon/imessage/v1/attachment_service.ts";
import { AttachmentServiceDefinition } from "../generated/photon/imessage/v1/attachment_service.ts";
import type { ChatServiceClient } from "../generated/photon/imessage/v1/chat_service.ts";
import { ChatServiceDefinition } from "../generated/photon/imessage/v1/chat_service.ts";
import type { EventServiceClient } from "../generated/photon/imessage/v1/event_service.ts";
import { EventServiceDefinition } from "../generated/photon/imessage/v1/event_service.ts";
import type { GroupServiceClient } from "../generated/photon/imessage/v1/group_service.ts";
import { GroupServiceDefinition } from "../generated/photon/imessage/v1/group_service.ts";
import type { LocationServiceClient } from "../generated/photon/imessage/v1/location_service.ts";
import { LocationServiceDefinition } from "../generated/photon/imessage/v1/location_service.ts";
import type { MessageServiceClient } from "../generated/photon/imessage/v1/message_service.ts";
// Generated ts-proto ServiceDefinition instances (runtime descriptors)
import { MessageServiceDefinition } from "../generated/photon/imessage/v1/message_service.ts";
import type { PollServiceClient } from "../generated/photon/imessage/v1/poll_service.ts";
import { PollServiceDefinition } from "../generated/photon/imessage/v1/poll_service.ts";
import type { RetryOptions } from "../types/common.ts";
// Middleware
import {
  authMiddleware,
  idempotencyMiddleware,
  retryMiddleware,
  timeoutMiddleware,
  trailingMetadataCaptureMiddleware,
} from "./metadata.ts";

// ---------------------------------------------------------------------------
// Client type aliases
//
// Re-export with friendly names for resource classes. The ts-proto generated
// client interfaces have correct method signatures for nice-grpc usage.
// ---------------------------------------------------------------------------

export type { AddressServiceClient } from "../generated/photon/imessage/v1/address_service.ts";
export type { AttachmentServiceClient } from "../generated/photon/imessage/v1/attachment_service.ts";
export type { ChatServiceClient } from "../generated/photon/imessage/v1/chat_service.ts";
export type { EventServiceClient } from "../generated/photon/imessage/v1/event_service.ts";
export type { GroupServiceClient } from "../generated/photon/imessage/v1/group_service.ts";
export type { LocationServiceClient } from "../generated/photon/imessage/v1/location_service.ts";
export type { MessageServiceClient } from "../generated/photon/imessage/v1/message_service.ts";
export type { PollServiceClient } from "../generated/photon/imessage/v1/poll_service.ts";
// ---------------------------------------------------------------------------
// GrpcClients interface
// ---------------------------------------------------------------------------

/**
 * Container for all gRPC service clients and the underlying channels.
 *
 * The unary `channel` and streaming `streamChannel` are exposed so the caller
 * can close them when done (or use the client's `AsyncDisposable`
 * implementation).
 */
export interface GrpcClients {
  readonly addresses: AddressServiceClient;
  readonly attachments: AttachmentServiceClient;
  readonly attachmentsStream: AttachmentServiceClient;
  readonly channel: Channel;
  readonly chats: ChatServiceClient;
  readonly chatsStream: ChatServiceClient;
  readonly events: EventServiceClient;
  readonly groups: GroupServiceClient;
  readonly groupsStream: GroupServiceClient;
  readonly locations: LocationServiceClient;
  readonly locationsStream: LocationServiceClient;
  readonly messages: MessageServiceClient;
  readonly messagesStream: MessageServiceClient;
  readonly polls: PollServiceClient;
  readonly pollsStream: PollServiceClient;
  readonly streamChannel: Channel;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating the gRPC client bundle. */
export interface GrpcClientOptions {
  /** Server address, e.g. `"127.0.0.1:50051"`. */
  address: string;
  /**
   * Whether to automatically attach an `x-idempotency-key` header to
   * mutating RPC calls. Defaults to `false`.
   */
  autoIdempotency?: boolean;
  /**
   * Enable automatic retry with exponential backoff for retryable errors.
   * Pass `true` for default settings, or a `RetryOptions` object to
   * customise the behaviour.
   */
  retry?: boolean | RetryOptions;
  /**
   * Default timeout in milliseconds for unary RPC calls.
   * Sets a deadline on each call unless one is already provided.
   */
  timeout?: number;
  /**
   * Whether to use TLS. If `true`, the channel uses SSL credentials.
   * If `false`, this forces `ChannelCredentials.createInsecure()`.
   * Defaults to `true`.
   */
  tls?: boolean;
  /**
   * Bearer token for authentication. Can be a static string or an async
   * function that resolves a fresh token on each call.
   */
  token?: string | (() => Promise<string>);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a gRPC channel and all service clients with the configured
 * middleware.
 *
 * @example
 * ```ts
 * const clients = createGrpcClients({
 *   address: "127.0.0.1:50051",
 *   token: "my-secret-token",
 * });
 *
 * const response = await clients.messages.sendTextMessage({ ... });
 * ```
 */
export function createGrpcClients(options: GrpcClientOptions): GrpcClients {
  // --- Channel ---
  const credentials =
    (options.tls ?? true)
      ? ChannelCredentials.createSsl()
      : ChannelCredentials.createInsecure();

  const channel = createChannel(options.address, credentials);
  const streamChannel = createChannel(options.address, credentials);

  // --- Client factory with middleware ---
  //
  // Middleware is added outermost-first: the first .use() call runs first
  // in the call chain. Desired execution order:
  //   idempotency → retry → timeout → auth → trailingMetadataCapture → RPC
  let factory = createClientFactory();

  if (options.autoIdempotency) {
    factory = factory.use(idempotencyMiddleware());
  }

  if (options.retry) {
    const retryOpts = options.retry === true ? {} : options.retry;
    factory = factory.use(retryMiddleware(retryOpts));
  }

  if (options.timeout) {
    factory = factory.use(timeoutMiddleware(options.timeout));
  }

  if (options.token) {
    factory = factory.use(authMiddleware(options.token));
  }

  // Always capture trailing metadata — nice-grpc strips it from errors,
  // but our error handler and retry middleware depend on it.
  factory = factory.use(trailingMetadataCaptureMiddleware());

  // --- Create clients ---
  // ts-proto definitions are natively compatible with nice-grpc, no casts needed.
  return {
    messages: factory.create(MessageServiceDefinition, channel),
    messagesStream: factory.create(MessageServiceDefinition, streamChannel),
    chats: factory.create(ChatServiceDefinition, channel),
    chatsStream: factory.create(ChatServiceDefinition, streamChannel),
    events: factory.create(EventServiceDefinition, streamChannel),
    groups: factory.create(GroupServiceDefinition, channel),
    groupsStream: factory.create(GroupServiceDefinition, streamChannel),
    attachments: factory.create(AttachmentServiceDefinition, channel),
    attachmentsStream: factory.create(
      AttachmentServiceDefinition,
      streamChannel
    ),
    addresses: factory.create(AddressServiceDefinition, channel),
    polls: factory.create(PollServiceDefinition, channel),
    pollsStream: factory.create(PollServiceDefinition, streamChannel),
    locations: factory.create(LocationServiceDefinition, channel),
    locationsStream: factory.create(LocationServiceDefinition, streamChannel),
    channel,
    streamChannel,
  };
}
