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

import { AddressServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/address_service";
import type { DownloadAttachmentResponse } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_service";
import { AttachmentServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_service";
import type { CompanionInfo } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_types";
import { CompanionKind } from "@photon-ai/aim-core/generated/photon/imessage/v1/attachment_types";
import { ChatServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/chat_service";
import { GroupServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/group_service";
import { LocationServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/location_service";
import type {
  GetEmbeddedMediaRequest,
  GetEmbeddedMediaResponse,
} from "@photon-ai/aim-core/generated/photon/imessage/v1/message_service";
import { MessageServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/message_service";
import { PollServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/poll_service";
import type {
  AddressServiceClient,
  AttachmentServiceClient,
  ChatServiceClient,
  GroupServiceClient,
  IMessageError,
  LocationServiceClient,
  MessageServiceClient,
  PollServiceClient,
  RetryOptions,
} from "@photon-ai/aim-core/internal";
import {
  DEFAULT_RETRY_OPTIONS,
  generateIdempotencyKey,
  sleep,
  ValidationError,
} from "@photon-ai/aim-core/internal";
import type { CallOptions } from "nice-grpc-common";
import {
  type Client,
  createConfig,
  createClient as createHeyApiClient,
} from "./generated/http/client/index.ts";
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
} from "./generated/http/sdk.gen.ts";
import {
  fromHttpErrorBody,
  fromTransportFailure,
  type HttpErrorBody,
} from "./http-error-handler.ts";

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
 * Ceiling on honoring a server's `Retry-After`: long enough to respect real
 * rate-limit windows, short enough that a pathological header can't stall a
 * call for minutes.
 */
const RETRY_AFTER_CAP_MS = 30_000;

/**
 * Sleep before retry attempt N: the server's `Retry-After` when it sent
 * one (capped), else exponential backoff with full jitter.
 */
async function retryDelay(
  retry: NonNullable<CallContext["retry"]>,
  attempt: number,
  lastError: IMessageError | undefined,
  signal: AbortSignal | undefined
): Promise<void> {
  if (lastError?.retryAfter !== undefined) {
    await sleep(Math.min(lastError.retryAfter, RETRY_AFTER_CAP_MS), signal);
    return;
  }
  const capped = Math.min(
    retry.initialDelay * 2 ** (attempt - 1),
    retry.maxDelay
  );
  await sleep(Math.random() * capped, signal);
}

/**
 * Run one SDK operation with auth, timeout, and retry. Retries follow the
 * gRPC transport's contract: only when the error is marked retryable —
 * explicitly by the server, or by status for body-less intermediary
 * failures — honoring `Retry-After`, else exponential backoff with full
 * jitter. The idempotency key (when enabled) is generated once and reused
 * across attempts so retries dedupe server-side.
 */
async function callWithRetry(
  ctx: CallContext,
  attemptCall: (headers: Record<string, string>) => SdkResult,
  mutating: boolean,
  signal: AbortSignal | undefined
): Promise<unknown> {
  const headers = await authHeaders(ctx, mutating);
  const maxAttempts = ctx.retry?.maxAttempts ?? 1;
  let lastError: IMessageError | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && ctx.retry) {
      await retryDelay(ctx.retry, attempt, lastError, signal);
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
      outcome.response.status,
      outcome.response.headers
    );
    if (!(error.retryable && ctx.retry) || attempt === maxAttempts - 1) {
      throw error;
    }
    lastError = error;
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

/**
 * Fetch a raw route with auth, timeout, and the same retry contract as the
 * JSON ops. Only status-level failures retry — a retryable error here means
 * no body byte was ever consumed, so re-issuing is safe (uploads reuse one
 * idempotency key across attempts). Failures while streaming a body happen
 * after this returns and are never retried.
 */
async function rawFetch(
  ctx: CallContext,
  url: string,
  init: {
    method: "GET" | "POST";
    // FormData bodies rely on fetch setting the multipart content-type —
    // the boundary is lost if we ever set that header ourselves.
    body?: Uint8Array | FormData;
    mutating?: boolean;
    signal?: AbortSignal | undefined;
  }
): Promise<Response> {
  const headers = await authHeaders(ctx, init.mutating ?? false);
  const signal = combineSignals(init.signal, ctx.timeout);
  const maxAttempts = ctx.retry?.maxAttempts ?? 1;
  let lastError: IMessageError | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && ctx.retry) {
      await retryDelay(ctx.retry, attempt, lastError, signal);
    }
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
    if (response.ok) {
      return response;
    }
    let errorBody: HttpErrorBody = {};
    try {
      errorBody = (await response.json()) as HttpErrorBody;
    } catch {
      // non-JSON error body (e.g. a proxy) — fall back to the status code
    }
    const error = fromHttpErrorBody(
      errorBody,
      response.status,
      response.headers
    );
    if (!(error.retryable && ctx.retry) || attempt === maxAttempts - 1) {
      throw error;
    }
    lastError = error;
  }
  throw fromTransportFailure(new Error("retry budget exhausted"));
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
    if (!request.fileName) {
      throw new ValidationError("fileName is required", {
        code: "invalidArgument",
        context: {},
        retryable: false,
        grpcCode: 3,
      });
    }
    // A companion (Live Photo video) turns the raw-body POST into
    // multipart/form-data — the middleware branches on content-type and
    // populates UploadAttachmentRequest.companion from the extra parts.
    let body: Uint8Array | FormData;
    if (request.companion) {
      // The cast mirrors rawFetch's `as never` body cast: lib.dom's BlobPart
      // rejects Uint8Array<ArrayBufferLike> over SharedArrayBuffer variance,
      // which never occurs here.
      const blobOf = (bytes: Uint8Array | undefined): Blob =>
        new Blob([(bytes ?? new Uint8Array()) as unknown as BlobPart]);
      const form = new FormData();
      form.append("file", blobOf(request.data));
      form.append("companion", blobOf(request.companion.data));
      form.append("companionKind", String(request.companion.kind));
      body = form;
    } else {
      body = request.data ?? new Uint8Array();
    }
    const queryParams = new URLSearchParams({ fileName: request.fileName });
    const response = await rawFetch(
      ctx,
      `${ctx.baseUrl}/v1/attachments:upload?${queryParams}`,
      {
        method: "POST",
        body,
        mutating: true,
        signal: options?.signal ?? undefined,
      }
    );
    return codec.responseType.fromJSON(await response.json());
  };
}

/** Non-empty chunks of a raw route's streamed response body. */
async function* bodyChunks(response: Response): AsyncGenerator<Uint8Array> {
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
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const CONTENT_DISPOSITION_FILENAME = /filename="([^"]*)"/;

/**
 * The companion raw route carries `CompanionInfo` as HTTP headers (the
 * metadata route does not expose the companion at all).
 */
function companionInfoFromHeaders(headers: Headers): CompanionInfo {
  const disposition = headers.get("content-disposition") ?? "";
  return {
    fileName: CONTENT_DISPOSITION_FILENAME.exec(disposition)?.[1] ?? "",
    kind: Number(
      headers.get("x-companion-kind") ??
        CompanionKind.COMPANION_KIND_UNSPECIFIED
    ) as CompanionKind,
    mimeType: headers.get("content-type") ?? "application/octet-stream",
    totalBytes: Number(headers.get("x-companion-total-bytes") ?? 0),
  };
}

function downloadAttachmentMethod(
  ctx: CallContext,
  getInfo: AttachmentServiceClient["getAttachmentInfo"]
): AttachmentServiceClient["downloadAttachment"] {
  return (request, options?: CallOptions) => {
    async function* frames(): AsyncGenerator<DownloadAttachmentResponse> {
      // Frame 0 (header): built from the metadata route — the raw download
      // route carries metadata only as HTTP headers.
      const info = await getInfo(
        { attachmentGuid: request.attachmentGuid },
        options
      );
      const guid = encodeURIComponent(request.attachmentGuid ?? "");

      // A companion (Live Photo video) rides its own raw route. Open it
      // before the header frame is emitted so the frame can carry the
      // CompanionInfo built from its response headers; its body is drained
      // after the primary chunks, preserving the gRPC frame order.
      const hasCompanion =
        info.attachment?.companionKind !== undefined &&
        info.attachment.companionKind !==
          CompanionKind.COMPANION_KIND_UNSPECIFIED;
      let companionResponse: Response | undefined;
      if (hasCompanion) {
        companionResponse = await rawFetch(
          ctx,
          `${ctx.baseUrl}/v1/attachments/${guid}/companion`,
          { method: "GET", signal: options?.signal ?? undefined }
        );
      }
      yield {
        header: {
          attachment: info.attachment,
          companion: companionResponse
            ? companionInfoFromHeaders(companionResponse.headers)
            : undefined,
        },
        primaryChunk: undefined,
        companionChunk: undefined,
      } as DownloadAttachmentResponse;

      const response = await rawFetch(
        ctx,
        `${ctx.baseUrl}/v1/attachments/${guid}/data`,
        { method: "GET", signal: options?.signal ?? undefined }
      );
      for await (const chunk of bodyChunks(response)) {
        yield {
          header: undefined,
          primaryChunk: chunk,
          companionChunk: undefined,
        } as DownloadAttachmentResponse;
      }
      if (companionResponse) {
        for await (const chunk of bodyChunks(companionResponse)) {
          yield {
            header: undefined,
            primaryChunk: undefined,
            companionChunk: chunk,
          } as DownloadAttachmentResponse;
        }
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
