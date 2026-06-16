/**
 * Creates the Connect grpc-web transport and all service clients.
 *
 * This module is the single entry point for establishing a connection. It
 * wires up the grpc-web transport, auth/idempotency/timeout/retry
 * interceptors, and returns typed clients for every service defined in the
 * proto contract.
 *
 * The transport speaks gRPC-web over HTTP (via `fetch`), so it works both in
 * browsers and in Node 18+ — typically fronted by an Envoy grpc-web proxy.
 */

import {
  type Client,
  createClient,
  type Interceptor,
} from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { AddressService } from "../generated/photon/imessage/v1/address_service_pb.js";
import { AttachmentService } from "../generated/photon/imessage/v1/attachment_service_pb.js";
import { ChatService } from "../generated/photon/imessage/v1/chat_service_pb.js";
import { EventService } from "../generated/photon/imessage/v1/event_service_pb.js";
import { GroupService } from "../generated/photon/imessage/v1/group_service_pb.js";
import { LocationService } from "../generated/photon/imessage/v1/location_service_pb.js";
import { MessageService } from "../generated/photon/imessage/v1/message_service_pb.js";
import { PollService } from "../generated/photon/imessage/v1/poll_service_pb.js";
import type { RetryOptions } from "../types/common.ts";
// Interceptors
import {
  authInterceptor,
  idempotencyInterceptor,
  retryInterceptor,
  timeoutInterceptor,
} from "./metadata.ts";

// ---------------------------------------------------------------------------
// Client type aliases
//
// `Client<typeof Service>` gives each method a `Promise<Response>` return for
// unary RPCs and an `AsyncIterable<Response>` for server-streaming RPCs, with
// request bodies typed as init shapes (plain objects).
// ---------------------------------------------------------------------------

export type AddressServiceClient = Client<typeof AddressService>;
export type AttachmentServiceClient = Client<typeof AttachmentService>;
export type ChatServiceClient = Client<typeof ChatService>;
export type EventServiceClient = Client<typeof EventService>;
export type GroupServiceClient = Client<typeof GroupService>;
export type LocationServiceClient = Client<typeof LocationService>;
export type MessageServiceClient = Client<typeof MessageService>;
export type PollServiceClient = Client<typeof PollService>;

// ---------------------------------------------------------------------------
// GrpcClients interface
// ---------------------------------------------------------------------------

/** Container for all Connect service clients. */
export interface GrpcClients {
  readonly addresses: AddressServiceClient;
  readonly attachments: AttachmentServiceClient;
  readonly chats: ChatServiceClient;
  readonly events: EventServiceClient;
  readonly groups: GroupServiceClient;
  readonly locations: LocationServiceClient;
  readonly messages: MessageServiceClient;
  readonly polls: PollServiceClient;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating the Connect client bundle. */
export interface GrpcClientOptions {
  /**
   * Whether to automatically attach an `x-idempotency-key` header to
   * mutating RPC calls. Defaults to `false`.
   */
  autoIdempotency?: boolean;
  /**
   * Base URL of the gRPC-web endpoint, e.g.
   * `"https://staging-spectrum-imessage-web.photon.codes"`. Requests are made
   * to `<baseUrl>/<package>.<service>/<method>`.
   */
  baseUrl: string;
  /**
   * Enable automatic retry with exponential backoff for retryable errors.
   * Pass `true` for default settings, or a `RetryOptions` object to
   * customise the behaviour.
   */
  retry?: boolean | RetryOptions;
  /**
   * Default timeout in milliseconds for unary RPC calls.
   * Sets a deadline on each unary call; streaming calls are left open.
   */
  timeout?: number;
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
 * Create a grpc-web transport and all service clients with the configured
 * interceptors.
 *
 * @example
 * ```ts
 * const clients = createGrpcClients({
 *   baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
 *   token: "my-secret-token",
 * });
 *
 * const response = await clients.messages.sendTextMessage({ ... });
 * ```
 */
export function createGrpcClients(options: GrpcClientOptions): GrpcClients {
  // Interceptors are ordered outermost-first. Connect applies index 0 as the
  // outermost wrapper, so the call chain is:
  //   idempotency → retry → timeout → auth → RPC
  //
  // Idempotency is outermost so a single key is reused across retries; auth is
  // innermost so a fresh token is resolved on every (re)attempt.
  const interceptors: Interceptor[] = [];

  if (options.autoIdempotency) {
    interceptors.push(idempotencyInterceptor());
  }

  if (options.retry) {
    const retryOpts = options.retry === true ? {} : options.retry;
    interceptors.push(retryInterceptor(retryOpts));
  }

  if (options.timeout) {
    interceptors.push(timeoutInterceptor(options.timeout));
  }

  if (options.token) {
    interceptors.push(authInterceptor(options.token));
  }

  const transport = createGrpcWebTransport({
    baseUrl: options.baseUrl,
    interceptors,
  });

  return {
    messages: createClient(MessageService, transport),
    chats: createClient(ChatService, transport),
    events: createClient(EventService, transport),
    groups: createClient(GroupService, transport),
    attachments: createClient(AttachmentService, transport),
    addresses: createClient(AddressService, transport),
    polls: createClient(PollService, transport),
    locations: createClient(LocationService, transport),
  };
}
