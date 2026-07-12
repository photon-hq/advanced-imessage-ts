/**
 * The HTTP transport: plain `fetch` against the REST transcoding middleware
 * (imessage-server-v2-http), which forwards to the iMessage plane over gRPC.
 *
 * This module is the single entry point for establishing a connection. It
 * replaces the former nice-grpc transport so the SDK runs anywhere `fetch`
 * exists — Cloudflare Workers, edge runtimes, browsers, Node, Bun.
 *
 * How it works: routes live in the hey-api generated SDK
 * (`src/generated/http`, regenerated from the middleware's OpenAPI spec —
 * `bun run generate:http`), so the client and the middleware can never
 * disagree on paths. Requests/responses are proto3-JSON, produced and
 * parsed by the ts-proto codecs (`toJSON`/`fromJSON`) — the exact message
 * objects the resources already construct and consume, so the resource and
 * mapper layers are untouched.
 *
 * Raw-bytes endpoints (attachment upload/download, embedded media) bypass
 * JSON and use the middleware's dedicated raw routes.
 */

import type { CallOptions } from "nice-grpc-common";
import {
  fromHttpErrorBody,
  fromTransportFailure,
  type HttpErrorBody,
} from "../errors/http-error-handler.ts";
import { ValidationError } from "../errors/imessage-error.ts";
import {
  type Client,
  createConfig,
  createClient as createHeyApiClient,
} from "../generated/http/client/index.ts";
import {
  addressServiceGetAddressInfo,
  addressServiceGetFocusStatus,
  addressServiceGetIMessageAvailability,
  attachmentServiceGetAttachmentInfo,
  chatServiceCreateChat,
  chatServiceGetChat,
  chatServiceGetChatCount,
  chatServiceHasBackground,
  chatServiceMarkChatRead,
  chatServiceRemoveBackground,
  chatServiceSetBackground,
  chatServiceSetTyping,
  chatServiceShareContactInfo,
  groupServiceAddParticipants,
  groupServiceGetIcon,
  groupServiceLeaveGroup,
  groupServiceRemoveIcon,
  groupServiceRemoveParticipants,
  groupServiceSetDisplayName,
  groupServiceSetIcon,
  locationServiceGetSharedFriendLocation,
  locationServiceListSharedFriendLocations,
  locationServiceRequestFriendLocationSharing,
  messageServiceEditMessage,
  messageServiceGetMessage,
  messageServiceListChatMessages,
  messageServiceListRecentMessages,
  messageServiceNotifySilencedMessage,
  messageServicePlaceSticker,
  messageServiceSendAttachmentMessage,
  messageServiceSendCustomizedMiniAppMessage,
  messageServiceSendMultipartMessage,
  messageServiceSendTextMessage,
  messageServiceSetReaction,
  messageServiceUnsendMessage,
  messageServiceUpdateCustomizedMiniAppMessage,
  pollServiceAddPollOption,
  pollServiceCreatePoll,
  pollServiceGetPoll,
  pollServiceUnvotePoll,
  pollServiceVotePoll,
} from "../generated/http/sdk.gen.ts";
import type { AddressServiceClient as GenAddressServiceClient } from "../generated/photon/imessage/v1/address_service.ts";
import { AddressServiceDefinition } from "../generated/photon/imessage/v1/address_service.ts";
import type {
  DownloadAttachmentResponse,
  AttachmentServiceClient as GenAttachmentServiceClient,
} from "../generated/photon/imessage/v1/attachment_service.ts";
import { AttachmentServiceDefinition } from "../generated/photon/imessage/v1/attachment_service.ts";
import type { ChatServiceClient as GenChatServiceClient } from "../generated/photon/imessage/v1/chat_service.ts";
import { ChatServiceDefinition } from "../generated/photon/imessage/v1/chat_service.ts";
import type { GroupServiceClient as GenGroupServiceClient } from "../generated/photon/imessage/v1/group_service.ts";
import { GroupServiceDefinition } from "../generated/photon/imessage/v1/group_service.ts";
import type { LocationServiceClient as GenLocationServiceClient } from "../generated/photon/imessage/v1/location_service.ts";
import { LocationServiceDefinition } from "../generated/photon/imessage/v1/location_service.ts";
import type {
  MessageServiceClient as GenMessageServiceClient,
  GetEmbeddedMediaRequest,
  GetEmbeddedMediaResponse,
} from "../generated/photon/imessage/v1/message_service.ts";
import { MessageServiceDefinition } from "../generated/photon/imessage/v1/message_service.ts";
import type { PollServiceClient as GenPollServiceClient } from "../generated/photon/imessage/v1/poll_service.ts";
import { PollServiceDefinition } from "../generated/photon/imessage/v1/poll_service.ts";
import type { RetryOptions } from "../types/common.ts";
import { generateIdempotencyKey } from "../utils/idempotency.ts";
import { DEFAULT_RETRY_OPTIONS } from "../utils/retry.ts";
import { sleep } from "../utils/sleep.ts";

// ---------------------------------------------------------------------------
// Client type aliases
//
// The unary subset of the ts-proto client interfaces — streaming RPCs ride
// Fusor/webhooks now, not this transport. Resource classes type their
// injected client against these.
// ---------------------------------------------------------------------------

export type AddressServiceClient = GenAddressServiceClient;
export type AttachmentServiceClient = GenAttachmentServiceClient;
export type ChatServiceClient = Omit<
  GenChatServiceClient,
  "subscribeChatEvents"
>;
export type GroupServiceClient = Omit<
  GenGroupServiceClient,
  "subscribeGroupEvents"
>;
export type LocationServiceClient = Omit<
  GenLocationServiceClient,
  "watchSharedFriendLocations"
>;
export type MessageServiceClient = Omit<
  GenMessageServiceClient,
  "subscribeMessageEvents"
>;
export type PollServiceClient = Omit<
  GenPollServiceClient,
  "subscribePollEvents"
>;

export interface HttpClientOptions {
  /**
   * Middleware address: `host[:port]` or a full `http(s)://` URL. Bare
   * hosts get a scheme from `tls` (default https).
   */
  readonly address: string;
  readonly autoIdempotency?: boolean;
  readonly retry?: boolean | RetryOptions;
  /**
   * Dedicated iMessage instance id, sent as `x-photon-server` on every call
   * so the middleware routes to that instance instead of the shared proxy.
   * Requires a token the instance accepts (dedicated mode). Omit for shared.
   */
  readonly server?: string;
  readonly timeout?: number;
  readonly tls?: boolean;
  readonly token: string | (() => Promise<string>);
}

export interface HttpClients {
  addresses: AddressServiceClient;
  attachments: AttachmentServiceClient;
  chats: ChatServiceClient;
  groups: GroupServiceClient;
  locations: LocationServiceClient;
  messages: MessageServiceClient;
  polls: PollServiceClient;
}

// ---------------------------------------------------------------------------
// Operation tables — ts-proto method key → generated SDK operation.
//
// The generated SDK owns the URL/verb for every route; the entries here only
// say how the proto3-JSON request maps onto the operation: `body` ops POST
// the whole message as JSON, `query` ops spread it into query parameters
// (minus `pathParam`, which rides in the URL path).
// ---------------------------------------------------------------------------

type SdkResult = Promise<{
  data?: unknown;
  error?: unknown;
  /** Absent when the request never produced a response (network failure). */
  response?: Response;
}>;

type SdkFn = (options: {
  body?: unknown;
  client: Client;
  headers?: Record<string, string>;
  path?: Record<string, unknown>;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
}) => SdkResult;

const TRAILING_SLASHES = /\/+$/;

interface Op {
  readonly fn: SdkFn;
  readonly kind: "body" | "query";
  readonly pathParam?: string;
}

const body = (fn: unknown): Op => ({ fn: fn as SdkFn, kind: "body" });
const query = (fn: unknown, pathParam?: string): Op =>
  pathParam
    ? { fn: fn as SdkFn, kind: "query", pathParam }
    : { fn: fn as SdkFn, kind: "query" };

const MESSAGE_OPS: Record<string, Op> = {
  editMessage: body(messageServiceEditMessage),
  getMessage: query(messageServiceGetMessage, "messageGuid"),
  listChatMessages: query(messageServiceListChatMessages),
  listRecentMessages: query(messageServiceListRecentMessages),
  notifySilencedMessage: body(messageServiceNotifySilencedMessage),
  placeSticker: body(messageServicePlaceSticker),
  sendAttachmentMessage: body(messageServiceSendAttachmentMessage),
  sendCustomizedMiniAppMessage: body(
    messageServiceSendCustomizedMiniAppMessage
  ),
  sendMultipartMessage: body(messageServiceSendMultipartMessage),
  sendTextMessage: body(messageServiceSendTextMessage),
  setReaction: body(messageServiceSetReaction),
  unsendMessage: body(messageServiceUnsendMessage),
  updateCustomizedMiniAppMessage: body(
    messageServiceUpdateCustomizedMiniAppMessage
  ),
};

const CHAT_OPS: Record<string, Op> = {
  createChat: body(chatServiceCreateChat),
  getChat: query(chatServiceGetChat),
  getChatCount: query(chatServiceGetChatCount),
  hasBackground: query(chatServiceHasBackground),
  markChatRead: body(chatServiceMarkChatRead),
  removeBackground: body(chatServiceRemoveBackground),
  setBackground: body(chatServiceSetBackground),
  setTyping: body(chatServiceSetTyping),
  shareContactInfo: body(chatServiceShareContactInfo),
};

const GROUP_OPS: Record<string, Op> = {
  addParticipants: body(groupServiceAddParticipants),
  getIcon: query(groupServiceGetIcon),
  leaveGroup: body(groupServiceLeaveGroup),
  removeIcon: body(groupServiceRemoveIcon),
  removeParticipants: body(groupServiceRemoveParticipants),
  setDisplayName: body(groupServiceSetDisplayName),
  setIcon: body(groupServiceSetIcon),
};

const POLL_OPS: Record<string, Op> = {
  addPollOption: body(pollServiceAddPollOption),
  createPoll: body(pollServiceCreatePoll),
  getPoll: query(pollServiceGetPoll, "pollMessageGuid"),
  unvotePoll: body(pollServiceUnvotePoll),
  votePoll: body(pollServiceVotePoll),
};

const ADDRESS_OPS: Record<string, Op> = {
  getAddressInfo: query(addressServiceGetAddressInfo),
  getFocusStatus: query(addressServiceGetFocusStatus),
  getIMessageAvailability: query(addressServiceGetIMessageAvailability),
};

const LOCATION_OPS: Record<string, Op> = {
  getSharedFriendLocation: query(locationServiceGetSharedFriendLocation),
  listSharedFriendLocations: query(locationServiceListSharedFriendLocations),
  requestFriendLocationSharing: body(
    locationServiceRequestFriendLocationSharing
  ),
};

const ATTACHMENT_OPS: Record<string, Op> = {
  getAttachmentInfo: query(
    attachmentServiceGetAttachmentInfo,
    "attachmentGuid"
  ),
};

// ---------------------------------------------------------------------------
// Core call machinery
// ---------------------------------------------------------------------------

interface CallContext {
  readonly autoIdempotency: boolean;
  readonly baseUrl: string;
  readonly client: Client;
  readonly retry: Required<
    Pick<RetryOptions, "initialDelay" | "maxAttempts" | "maxDelay">
  > | null;
  readonly server: string | undefined;
  readonly timeout: number | undefined;
  readonly token: string | (() => Promise<string>);
}

function baseUrlFrom(options: HttpClientOptions): string {
  const address = options.address.replace(TRAILING_SLASHES, "");
  if (address.startsWith("http://") || address.startsWith("https://")) {
    return address;
  }
  const scheme = (options.tls ?? true) ? "https" : "http";
  return `${scheme}://${address}`;
}

function combineSignals(
  callSignal: AbortSignal | undefined,
  timeout: number | undefined
): AbortSignal | undefined {
  const signals: AbortSignal[] = [];
  if (callSignal) {
    signals.push(callSignal);
  }
  if (timeout !== undefined) {
    signals.push(AbortSignal.timeout(timeout));
  }
  if (signals.length === 0) {
    return undefined;
  }
  return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
}

async function authHeaders(
  ctx: CallContext,
  mutating: boolean
): Promise<Record<string, string>> {
  const token = typeof ctx.token === "function" ? await ctx.token() : ctx.token;
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  if (ctx.server) {
    headers["x-photon-server"] = ctx.server;
  }
  if (mutating && ctx.autoIdempotency) {
    headers["x-idempotency-key"] = generateIdempotencyKey();
  }
  return headers;
}

/**
 * Run one SDK operation with auth, timeout, and retry. Retries follow the
 * gRPC transport's contract: only when the server explicitly marked the
 * error retryable, with exponential backoff and full jitter. The
 * idempotency key (when enabled) is generated once and reused across
 * attempts so retries dedupe server-side.
 */
async function callWithRetry(
  ctx: CallContext,
  attemptCall: (headers: Record<string, string>) => SdkResult,
  mutating: boolean,
  signal: AbortSignal | undefined
): Promise<unknown> {
  const headers = await authHeaders(ctx, mutating);
  const maxAttempts = ctx.retry?.maxAttempts ?? 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && ctx.retry) {
      const capped = Math.min(
        ctx.retry.initialDelay * 2 ** (attempt - 1),
        ctx.retry.maxDelay
      );
      await sleep(Math.random() * capped, signal);
    }
    let outcome: Awaited<SdkResult>;
    try {
      outcome = await attemptCall(headers);
    } catch (error) {
      throw fromTransportFailure(error);
    }
    if (!outcome.response) {
      // The generated client catches fetch-level failures and surfaces them
      // as `error` with no response.
      throw fromTransportFailure(outcome.error);
    }
    if (outcome.response.ok) {
      return outcome.data;
    }
    const error = fromHttpErrorBody(
      (outcome.error ?? {}) as HttpErrorBody,
      outcome.response.status
    );
    if (!(error.retryable && ctx.retry) || attempt === maxAttempts - 1) {
      throw error;
    }
  }
  throw fromTransportFailure(new Error("retry budget exhausted"));
}

interface UnaryCodec<Req, Res> {
  requestType: { toJSON(message: Req): unknown };
  responseType: { fromJSON(object: unknown): Res };
}

async function unaryCall<Req, Res>(
  ctx: CallContext,
  op: Op,
  codec: UnaryCodec<Req, Res>,
  request: Req,
  options?: CallOptions
): Promise<Res> {
  const json = codec.requestType.toJSON(request) as Record<string, unknown>;
  const signal = combineSignals(options?.signal ?? undefined, ctx.timeout);

  let path: Record<string, unknown> | undefined;
  let queryParams: Record<string, unknown> | undefined;
  if (op.kind === "query") {
    queryParams = { ...json };
    if (op.pathParam) {
      path = { [op.pathParam]: json[op.pathParam] };
      delete queryParams[op.pathParam];
    }
  }

  const data = await callWithRetry(
    ctx,
    (headers) =>
      op.fn({
        client: ctx.client,
        headers,
        ...(op.kind === "body" ? { body: json } : {}),
        ...(queryParams ? { query: queryParams } : {}),
        ...(path ? { path } : {}),
        ...(signal ? { signal } : {}),
      }),
    op.kind === "body",
    signal
  );
  try {
    return codec.responseType.fromJSON(data ?? {});
  } catch (error) {
    throw fromTransportFailure(error);
  }
}

function serviceClient<T>(
  ctx: CallContext,
  definition: { methods: Record<string, unknown> },
  ops: Record<string, Op>,
  overrides: Record<string, unknown> = {}
): T {
  const client: Record<string, unknown> = { ...overrides };
  for (const [key, op] of Object.entries(ops)) {
    const codec = definition.methods[key] as
      | UnaryCodec<unknown, unknown>
      | undefined;
    if (!codec) {
      throw new Error(`operation table drift: unknown method \`${key}\``);
    }
    client[key] = (request: unknown, options?: CallOptions) =>
      unaryCall(ctx, op, codec, request, options);
  }
  return client as T;
}

// ---------------------------------------------------------------------------
// Raw-bytes endpoints (bypass JSON transcoding; not part of the OpenAPI
// spec — these mirror the middleware's hand-mounted routes)
// ---------------------------------------------------------------------------

async function rawFetch(
  ctx: CallContext,
  url: string,
  init: {
    method: "GET" | "POST";
    body?: Uint8Array;
    mutating?: boolean;
    signal?: AbortSignal | undefined;
  }
): Promise<Response> {
  const headers = await authHeaders(ctx, init.mutating ?? false);
  const signal = combineSignals(init.signal, ctx.timeout);
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body as never,
      signal: signal ?? null,
    });
  } catch (error) {
    throw fromTransportFailure(error);
  }
  if (!response.ok) {
    let errorBody: HttpErrorBody = {};
    try {
      errorBody = (await response.json()) as HttpErrorBody;
    } catch {
      // non-JSON error body (e.g. a proxy) — fall back to the status code
    }
    throw fromHttpErrorBody(errorBody, response.status);
  }
  return response;
}

function embeddedMediaMethod(ctx: CallContext) {
  return async (
    request: GetEmbeddedMediaRequest,
    options?: CallOptions
  ): Promise<GetEmbeddedMediaResponse> => {
    const queryParams = new URLSearchParams({
      chatGuid: request.chatGuid ?? "",
      messageGuid: request.messageGuid ?? "",
    });
    const response = await rawFetch(
      ctx,
      `${ctx.baseUrl}/v1/messages:embeddedMedia?${queryParams}`,
      { method: "GET", signal: options?.signal ?? undefined }
    );
    const data = new Uint8Array(await response.arrayBuffer());
    const mimeType =
      response.headers.get("content-type") ?? "application/octet-stream";
    return { media: { data, mimeType } };
  };
}

function uploadAttachmentMethod(
  ctx: CallContext
): AttachmentServiceClient["uploadAttachment"] {
  const codec = AttachmentServiceDefinition.methods.uploadAttachment;
  return async (request, options?: CallOptions) => {
    if (request.companion) {
      throw new ValidationError(
        "Live Photo companion uploads are not supported over the HTTP transport yet",
        {
          code: "operationNotSupported",
          context: {},
          retryable: false,
          grpcCode: 3,
        }
      );
    }
    if (!request.fileName) {
      throw new ValidationError("fileName is required", {
        code: "invalidArgument",
        context: {},
        retryable: false,
        grpcCode: 3,
      });
    }
    const queryParams = new URLSearchParams({ fileName: request.fileName });
    const response = await rawFetch(
      ctx,
      `${ctx.baseUrl}/v1/attachments:upload?${queryParams}`,
      {
        method: "POST",
        body: request.data ?? new Uint8Array(),
        mutating: true,
        signal: options?.signal ?? undefined,
      }
    );
    return codec.responseType.fromJSON(await response.json());
  };
}

function downloadAttachmentMethod(
  ctx: CallContext,
  getInfo: AttachmentServiceClient["getAttachmentInfo"]
): AttachmentServiceClient["downloadAttachment"] {
  return (request, options?: CallOptions) => {
    async function* frames(): AsyncGenerator<DownloadAttachmentResponse> {
      // Frame 0 (header): built from the metadata route — the raw download
      // route carries metadata only as HTTP headers. Companion bytes are not
      // available over HTTP (raw route forwards the primary payload only).
      const info = await getInfo(
        { attachmentGuid: request.attachmentGuid },
        options
      );
      yield {
        header: { attachment: info.attachment, companion: undefined },
        primaryChunk: undefined,
        companionChunk: undefined,
      } as DownloadAttachmentResponse;

      const response = await rawFetch(
        ctx,
        `${ctx.baseUrl}/v1/attachments/${encodeURIComponent(request.attachmentGuid ?? "")}/data`,
        { method: "GET", signal: options?.signal ?? undefined }
      );
      const responseBody = response.body;
      if (!responseBody) {
        return;
      }
      const reader = responseBody.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value && value.length > 0) {
            yield {
              header: undefined,
              primaryChunk: value,
              companionChunk: undefined,
            } as DownloadAttachmentResponse;
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
    return frames();
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the full set of HTTP-backed service clients. Each client object
 * satisfies the unary subset of its ts-proto `*ServiceClient` interface, so
 * the resource layer is transport-agnostic.
 */
export function createHttpClients(options: HttpClientOptions): HttpClients {
  let retry: CallContext["retry"] = null;
  if (options.retry) {
    const overrides = options.retry === true ? {} : options.retry;
    retry = { ...DEFAULT_RETRY_OPTIONS, ...overrides };
  }
  const baseUrl = baseUrlFrom(options);
  const ctx: CallContext = {
    autoIdempotency: options.autoIdempotency ?? false,
    baseUrl,
    client: createHeyApiClient(createConfig({ baseUrl })),
    retry,
    server: options.server,
    timeout: options.timeout,
    token: options.token,
  };

  const attachmentsBase = serviceClient<
    Pick<AttachmentServiceClient, "getAttachmentInfo">
  >(ctx, AttachmentServiceDefinition, ATTACHMENT_OPS);
  const attachments: AttachmentServiceClient = {
    ...attachmentsBase,
    uploadAttachment: uploadAttachmentMethod(ctx),
    downloadAttachment: downloadAttachmentMethod(
      ctx,
      attachmentsBase.getAttachmentInfo
    ),
  };

  return {
    addresses: serviceClient<AddressServiceClient>(
      ctx,
      AddressServiceDefinition,
      ADDRESS_OPS
    ),
    attachments,
    chats: serviceClient<ChatServiceClient>(
      ctx,
      ChatServiceDefinition,
      CHAT_OPS
    ),
    groups: serviceClient<GroupServiceClient>(
      ctx,
      GroupServiceDefinition,
      GROUP_OPS
    ),
    locations: serviceClient<LocationServiceClient>(
      ctx,
      LocationServiceDefinition,
      LOCATION_OPS
    ),
    messages: serviceClient<MessageServiceClient>(
      ctx,
      MessageServiceDefinition,
      MESSAGE_OPS,
      { getEmbeddedMedia: embeddedMediaMethod(ctx) }
    ),
    polls: serviceClient<PollServiceClient>(
      ctx,
      PollServiceDefinition,
      POLL_OPS
    ),
  };
}
