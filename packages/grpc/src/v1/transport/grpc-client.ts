/**
 * Creates and configures the nice-grpc channel and all service clients.
 *
 * This module is the single entry point for establishing a gRPC connection.
 * It wires up channel creation, auth middleware, optional idempotency
 * middleware, and returns typed clients for every service defined in the
 * proto contract.
 */

import type { AddressServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/address_service";
import { AddressServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/address_service";
import type { AttachmentServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_service";
import { AttachmentServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_service";
import type { ChatServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/chat_service";
import { ChatServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/chat_service";
import type { EventServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/event_service";
import { EventServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/event_service";
import type { GroupServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/group_service";
import { GroupServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/group_service";
import type { LocationServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/location_service";
import { LocationServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/location_service";
import type { MessageServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/message_service";
// Generated ts-proto ServiceDefinition instances (runtime descriptors)
import { MessageServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/message_service";
import type { PollServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/poll_service";
import { PollServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/poll_service";
import type { RetryOptions } from "@photon-ai/aim-core/internal";
import {
  type Channel,
  ChannelCredentials,
  type ChannelOptions,
  createChannel,
  createClientFactory,
} from "nice-grpc";
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

export type { AddressServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/address_service";
export type { AttachmentServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_service";
export type { ChatServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/chat_service";
export type { EventServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/event_service";
export type { GroupServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/group_service";
export type { LocationServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/location_service";
export type { MessageServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/message_service";
export type { PollServiceClient } from "@photon-ai/aim-core/generated/photon/imessage/v1/poll_service";
/**
 * `@grpc/grpc-js` channel options. Re-exported so callers can type custom
 * channel/keepalive overrides without importing from `nice-grpc` directly.
 */
export type { ChannelOptions as GrpcChannelOptions } from "nice-grpc";
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
   * Additional `@grpc/grpc-js` channel options merged onto (and able to
   * override) the SDK defaults for both the unary and streaming channels.
   * Use this to tune keepalive — e.g. `grpc.keepalive_time_ms` — without
   * waiting for an SDK release.
   */
  channelOptions?: ChannelOptions;
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
 * Maximum size (in bytes) of a single gRPC message in either direction,
 * sized to match the 100 MB backend request limit so attachment uploads and
 * downloads can use the full payload. `@grpc/grpc-js` otherwise defaults to
 * 4 MB on receive and unlimited on send.
 */
const MAX_MESSAGE_BYTES = 100 * 1024 * 1024;

/**
 * How often (ms) the client sends an HTTP/2 keepalive PING when no other
 * data is in flight. Chosen to match the server's ~30s heartbeat cadence and
 * to stay above the server-side minimum ping interval, so the client never
 * trips a GOAWAY `too_many_pings`. Lets a half-open connection (a silent
 * gateway drop with no RST/GOAWAY) be detected within
 * `keepalive_time_ms + keepalive_timeout_ms` instead of stalling forever.
 */
const KEEPALIVE_TIME_MS = 30_000;

/**
 * How long (ms) the client waits for a keepalive PING ACK before declaring
 * the connection dead and tearing it down.
 */
const KEEPALIVE_TIMEOUT_MS = 20_000;

/** Send keepalive pings even when there are no active RPC calls (`1` = on). */
const KEEPALIVE_PERMIT_WITHOUT_CALLS = 1;

/** Allow unlimited keepalive pings without data in flight (`0` = no cap). */
const KEEPALIVE_MAX_PINGS_WITHOUT_DATA = 0;

/**
 * Preserve grpc-js's effectively unlimited default within Bun's `u32` storage.
 * Bun 1.3.14 converts grpc-js's Number.MAX_SAFE_INTEGER default to a 1 MiB
 * limit; the largest `u32` avoids that conversion failure on Bun and Node.
 */
const MAX_SESSION_MEMORY_MB = 4_294_967_295;

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

  // Keepalive lets clients detect a half-open connection (failure mode 2 of
  // ENG-1688): a silent gateway drop that sends no RST/GOAWAY would otherwise
  // leave the event `for await` blocked forever. Applied to BOTH channels.
  // Caller-supplied `channelOptions` win, so SDK defaults stay tunable.
  const channelOptions: ChannelOptions = {
    "grpc.max_receive_message_length": MAX_MESSAGE_BYTES,
    "grpc.max_send_message_length": MAX_MESSAGE_BYTES,
    "grpc.keepalive_time_ms": KEEPALIVE_TIME_MS,
    "grpc.keepalive_timeout_ms": KEEPALIVE_TIMEOUT_MS,
    "grpc.keepalive_permit_without_calls": KEEPALIVE_PERMIT_WITHOUT_CALLS,
    "grpc.http2.max_pings_without_data": KEEPALIVE_MAX_PINGS_WITHOUT_DATA,
    "grpc-node.max_session_memory": MAX_SESSION_MEMORY_MB,
    ...options.channelOptions,
  };

  const channel = createChannel(options.address, credentials, channelOptions);
  const streamChannel = createChannel(
    options.address,
    credentials,
    channelOptions
  );

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
