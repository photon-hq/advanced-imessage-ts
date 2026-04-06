/**
 * Creates and configures the nice-grpc channel and all 8 service clients.
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
import type { GroupServiceClient } from "../generated/photon/imessage/v1/group_service.ts";
import { GroupServiceDefinition } from "../generated/photon/imessage/v1/group_service.ts";
import type { LocationServiceClient } from "../generated/photon/imessage/v1/location_service.ts";
import { LocationServiceDefinition } from "../generated/photon/imessage/v1/location_service.ts";
import type { MessageServiceClient } from "../generated/photon/imessage/v1/message_service.ts";
// Generated ts-proto ServiceDefinition instances (runtime descriptors)
import { MessageServiceDefinition } from "../generated/photon/imessage/v1/message_service.ts";
import type { PollServiceClient } from "../generated/photon/imessage/v1/poll_service.ts";
import { PollServiceDefinition } from "../generated/photon/imessage/v1/poll_service.ts";
import type { ScheduledMessageServiceClient } from "../generated/photon/imessage/v1/scheduled_message_service.ts";
import { ScheduledMessageServiceDefinition } from "../generated/photon/imessage/v1/scheduled_message_service.ts";

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
export type { GroupServiceClient } from "../generated/photon/imessage/v1/group_service.ts";
export type { LocationServiceClient } from "../generated/photon/imessage/v1/location_service.ts";
export type { MessageServiceClient } from "../generated/photon/imessage/v1/message_service.ts";
export type { PollServiceClient } from "../generated/photon/imessage/v1/poll_service.ts";
export type { ScheduledMessageServiceClient } from "../generated/photon/imessage/v1/scheduled_message_service.ts";

// ---------------------------------------------------------------------------
// GrpcClients interface
// ---------------------------------------------------------------------------

/**
 * Container for all gRPC service clients and the underlying channel.
 *
 * The `channel` is exposed so the caller can close it when done (or use
 * the client's `AsyncDisposable` implementation).
 */
export interface GrpcClients {
  readonly addresses: AddressServiceClient;
  readonly attachments: AttachmentServiceClient;
  readonly channel: Channel;
  readonly chats: ChatServiceClient;
  readonly groups: GroupServiceClient;
  readonly locations: LocationServiceClient;
  readonly messages: MessageServiceClient;
  readonly polls: PollServiceClient;
  readonly scheduledMessages: ScheduledMessageServiceClient;
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
   * Defaults to `false` (insecure).
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
 * Create a gRPC channel and all 8 service clients with the configured
 * middleware.
 *
 * @example
 * ```ts
 * const clients = createGrpcClients({
 *   address: "127.0.0.1:50051",
 *   token: "my-secret-token",
 * });
 *
 * const response = await clients.messages.send({ ... });
 * ```
 */
export function createGrpcClients(options: GrpcClientOptions): GrpcClients {
  // --- Channel ---
  const credentials = options.tls
    ? ChannelCredentials.createSsl()
    : ChannelCredentials.createInsecure();

  const channel = createChannel(options.address, credentials);

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
    chats: factory.create(ChatServiceDefinition, channel),
    groups: factory.create(GroupServiceDefinition, channel),
    attachments: factory.create(AttachmentServiceDefinition, channel),
    addresses: factory.create(AddressServiceDefinition, channel),
    polls: factory.create(PollServiceDefinition, channel),
    scheduledMessages: factory.create(
      ScheduledMessageServiceDefinition,
      channel
    ),
    locations: factory.create(LocationServiceDefinition, channel),
    channel,
  };
}
