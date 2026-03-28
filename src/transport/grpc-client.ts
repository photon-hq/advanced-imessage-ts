/**
 * Creates and configures the nice-grpc channel and all 8 service clients.
 *
 * This module is the single entry point for establishing a gRPC connection.
 * It wires up channel creation, auth middleware, optional idempotency
 * middleware, and returns typed clients for every service defined in the
 * proto contract.
 */

import {
  createChannel,
  createClientFactory,
  type Channel,
  ChannelCredentials,
} from "nice-grpc";
import type { IMessageServiceClient } from "../generated/photon/imessage/v1/message_service.client.ts";
import type { IChatServiceClient } from "../generated/photon/imessage/v1/chat_service.client.ts";
import type { IGroupServiceClient } from "../generated/photon/imessage/v1/group_service.client.ts";
import type { IAttachmentServiceClient } from "../generated/photon/imessage/v1/attachment_service.client.ts";
import type { IAddressServiceClient } from "../generated/photon/imessage/v1/address_service.client.ts";
import type { IPollServiceClient } from "../generated/photon/imessage/v1/poll_service.client.ts";
import type { IScheduledMessageServiceClient } from "../generated/photon/imessage/v1/scheduled_message_service.client.ts";
import type { ILocationServiceClient } from "../generated/photon/imessage/v1/location_service.client.ts";

// Generated protobuf-ts ServiceType instances (runtime descriptors)
import { MessageService } from "../generated/photon/imessage/v1/message_service.ts";
import { ChatService } from "../generated/photon/imessage/v1/chat_service.ts";
import { GroupService } from "../generated/photon/imessage/v1/group_service.ts";
import { AttachmentService } from "../generated/photon/imessage/v1/attachment_service.ts";
import { AddressService } from "../generated/photon/imessage/v1/address_service.ts";
import { PollService } from "../generated/photon/imessage/v1/poll_service.ts";
import { ScheduledMessageService } from "../generated/photon/imessage/v1/scheduled_message_service.ts";
import { LocationService } from "../generated/photon/imessage/v1/location_service.ts";

// Adapter to convert protobuf-ts ServiceType -> nice-grpc ServiceDefinition
import { fromProtobufTsService } from "./protobuf-ts-adapter.ts";

// Middleware
import { authMiddleware, idempotencyMiddleware } from "./metadata.ts";

// ---------------------------------------------------------------------------
// nice-grpc service definitions (converted from protobuf-ts)
// ---------------------------------------------------------------------------

const messageServiceDef = fromProtobufTsService(MessageService);
const chatServiceDef = fromProtobufTsService(ChatService);
const groupServiceDef = fromProtobufTsService(GroupService);
const attachmentServiceDef = fromProtobufTsService(AttachmentService);
const addressServiceDef = fromProtobufTsService(AddressService);
const pollServiceDef = fromProtobufTsService(PollService);
const scheduledMessageServiceDef = fromProtobufTsService(ScheduledMessageService);
const locationServiceDef = fromProtobufTsService(LocationService);

// ---------------------------------------------------------------------------
// Client type aliases
//
// nice-grpc's `Client<T>` cannot resolve method names from a dynamically
// built ServiceDefinition (via fromProtobufTsService). We re-export the
// protobuf-ts generated interfaces which have the correct method signatures.
// At runtime the nice-grpc client has these same methods — the cast in
// createGrpcClients is safe.
// ---------------------------------------------------------------------------

// Re-export with friendly names for resource classes
export type { IMessageServiceClient } from "../generated/photon/imessage/v1/message_service.client.ts";
export type { IChatServiceClient } from "../generated/photon/imessage/v1/chat_service.client.ts";
export type { IGroupServiceClient } from "../generated/photon/imessage/v1/group_service.client.ts";
export type { IAttachmentServiceClient } from "../generated/photon/imessage/v1/attachment_service.client.ts";
export type { IAddressServiceClient } from "../generated/photon/imessage/v1/address_service.client.ts";
export type { IPollServiceClient } from "../generated/photon/imessage/v1/poll_service.client.ts";
export type { IScheduledMessageServiceClient } from "../generated/photon/imessage/v1/scheduled_message_service.client.ts";
export type { ILocationServiceClient } from "../generated/photon/imessage/v1/location_service.client.ts";

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
  readonly messages: IMessageServiceClient;
  readonly chats: IChatServiceClient;
  readonly groups: IGroupServiceClient;
  readonly attachments: IAttachmentServiceClient;
  readonly addresses: IAddressServiceClient;
  readonly polls: IPollServiceClient;
  readonly scheduledMessages: IScheduledMessageServiceClient;
  readonly locations: ILocationServiceClient;
  readonly channel: Channel;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating the gRPC client bundle. */
export interface GrpcClientOptions {
  /** Server address, e.g. `"127.0.0.1:50051"`. */
  address: string;
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
  /**
   * Whether to automatically attach an `x-idempotency-key` header to
   * mutating RPC calls. Defaults to `false`.
   */
  autoIdempotency?: boolean;
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
  let factory = createClientFactory();

  // Idempotency middleware runs first (outermost), so it executes before auth.
  if (options.autoIdempotency) {
    factory = factory.use(idempotencyMiddleware());
  }

  // Auth middleware runs after idempotency (innermost), closest to the wire.
  if (options.token) {
    factory = factory.use(authMiddleware(options.token));
  }

  // --- Create clients ---
  // Cast to protobuf-ts client interfaces. At runtime nice-grpc creates
  // clients with the same method signatures — the cast is safe.
  return {
    messages: factory.create(messageServiceDef, channel) as unknown as IMessageServiceClient,
    chats: factory.create(chatServiceDef, channel) as unknown as IChatServiceClient,
    groups: factory.create(groupServiceDef, channel) as unknown as IGroupServiceClient,
    attachments: factory.create(attachmentServiceDef, channel) as unknown as IAttachmentServiceClient,
    addresses: factory.create(addressServiceDef, channel) as unknown as IAddressServiceClient,
    polls: factory.create(pollServiceDef, channel) as unknown as IPollServiceClient,
    scheduledMessages: factory.create(scheduledMessageServiceDef, channel) as unknown as IScheduledMessageServiceClient,
    locations: factory.create(locationServiceDef, channel) as unknown as ILocationServiceClient,
    channel,
  };
}
