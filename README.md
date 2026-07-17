# @photon-ai/advanced-imessage

TypeScript SDK for the Advanced iMessage server. **Supports two transports:
HTTP and gRPC** — pick per project, or mix them.

- **HTTP** (default): the SDK talks `fetch` to the REST middleware
  ([imessage-server-v2-http](https://github.com/photon-hq/imessage-server-v2-http)),
  which forwards to the iMessage plane — no gRPC in the client, so it runs
  wherever `fetch` exists: **Cloudflare Workers**, edge runtimes, browsers,
  Node, Bun, Deno. Inbound events ride webhooks — see
  [Inbound events](#inbound-events).
- **gRPC**: the full v1 surface, including the live
  `subscribeEvents`/`watch`/`events.catchUp` streams. Node/Bun only.

## Install

### HTTP

```bash
bun add @photon-ai/advanced-imessage
```

```ts
import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: process.env.IMESSAGE_TOKEN!,
});

const sent = await im.messages.sendText("any;-;alice@example.com", "hello");
console.log(sent.guid);

await im.close();
```

Runs on any runtime with `fetch` (Cloudflare Workers, Node `>=18.17`, Bun,
Deno, browsers). The package is ESM-only. Workers compatibility is enforced
in CI: every build bundles the SDK and boots it in workerd.

### gRPC

The gRPC transport needs its peer dependencies.

```bash
bun add @photon-ai/advanced-imessage nice-grpc nice-grpc-common @grpc/grpc-js
```

```ts
import { createClient } from "@photon-ai/advanced-imessage/grpc";

const im = createClient({
  address: "127.0.0.1:50051", // the gRPC server
  token: process.env.IMESSAGE_TOKEN!,
  tls: false,
});

const sent = await im.messages.sendText("any;-;alice@example.com", "hello");
console.log(sent.guid);

// gRPC keeps client-held live event streams:
for await (const event of im.messages.subscribeEvents()) {
  console.log(event.type, event.sequence);
}

await im.close();
```

Node `>=18.17` or Bun (native gRPC — not available on fetch-only runtimes
like Workers).

## Entrypoints

One package, three entrypoints:

| Import | What you get |
| --- | --- |
| `@photon-ai/advanced-imessage` | `createHttpClient`, `createGrpcClient`, and every shared type. HTTP-flavored: `ClientOptions` etc. are the HTTP client's. |
| `@photon-ai/advanced-imessage/http` | The HTTP transport only. Safe everywhere `fetch` exists. |
| `@photon-ai/advanced-imessage/grpc` | The gRPC transport: the full v1 surface, including `events` and the live `subscribeEvents`/`watch` streams. Node/Bun only. |

gRPC requires its optional peer dependencies (see [Install](#install)); HTTP-only installs never download or evaluate them.

## Migrating from v1

v1 of this package was gRPC-only, exported from the package root. Your code
keeps working with two changes — an import specifier and the peer install
above:

```diff
-import { createClient, type ClientOptions } from "@photon-ai/advanced-imessage";
+import { createClient, type ClientOptions } from "@photon-ai/advanced-imessage/grpc";
```

Every v1 export keeps its name on the `/grpc` subpath (`createClient` is an
alias of `createGrpcClient`). Live event streams stay gRPC-only — over HTTP,
inbound events ride webhooks instead (see [Inbound events](#inbound-events)).

## Connect

```ts
import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: process.env.IMESSAGE_TOKEN!,
});

await im.close();
```

`address` is the imessage-server-v2-http middleware: a bare `host[:port]` or
a full `http(s)://` URL. `token` may also be an async function when
credentials rotate — it is resolved fresh for every call:

```ts
const im = createHttpClient({
  address: "imessage.example.com",
  token: async () => process.env.IMESSAGE_TOKEN!,
});
```

Bare addresses default to `https`; set `tls: false` only for local
development.

## Chat GUIDs

Methods that take `chat` expect a server chat guid:

```ts
const direct = "any;-;alice@example.com";
const group = "any;+;group-chat-guid";
```

In normal code, pass `chat.guid` returned by `im.chats.create(...)`,
`im.chats.get(...)`, message results, or event payloads. The SDK does not turn
bare phone numbers, emails, or group IDs into chat GUIDs.

## Send Messages

```ts
import { MessageEffect, TextEffect } from "@photon-ai/advanced-imessage";

const chatGuid = "any;-;alice@example.com";

const sent = await im.messages.sendText(chatGuid, "Happy birthday", {
  effect: MessageEffect.confetti,
  formatting: [{ type: "effect", start: 0, length: 5, effect: TextEffect.bloom }],
  enableLinkPreview: true,
});

console.log(sent.guid);
```

Reply to a whole message:

```ts
await im.messages.sendText(chatGuid, "reply", {
  replyTo: sent.guid,
});
```

Reply to one bubble in a multipart message:

```ts
await im.messages.sendText(chatGuid, "reply to part 2", {
  replyTo: { guid: sent.guid, partIndex: 2 },
});
```

## Send Attachments

Attachments are sent by uploaded attachment GUID.

```ts
import { readFile } from "node:fs/promises";

const jpegBytes = await readFile("photo.jpg");

const uploaded = await im.attachments.upload({
  fileName: "photo.jpg",
  data: jpegBytes,
});

await im.messages.sendAttachment(chatGuid, uploaded.attachment.guid);
```

The SDK uploads raw bytes and returns a server-hosted attachment GUID. Use that
GUID with `messages.sendAttachment(...)`, `attachments.get(...)`, or
`attachments.downloadStream(...)`. The SDK does not expose server-local file
paths; this matters when the SDK and server run on different machines.

Upload, metadata lookup, and download have been live-tested with these
attachment formats:

- Images: `jpg`, `png`, `gif`, `tiff`, `bmp`, `webp`, `avif`, `svg`
- Video: `mov`, `mp4`, `webm`
- Audio: `aiff`, `caf`, `flac`, `m4a`, `mp3`, `ogg`, `wav`
- Text and structured text: `txt`, `md`, `csv`, `json`, `html`, `xml`, `rtf`
- Documents: `pdf`, `docx`, `xlsx`, `pptx`
- Contact and calendar: `vcf`, `ics`
- Archives and compressed payloads: `zip`, `tar`, `tar.gz`, `tgz`,
  `tar.bz2`, `tar.xz`, `gz`, `bz2`, `xz`

Downloads are streamed by GUID and preserve byte-for-byte content. The first
frame is metadata, followed by primary payload chunks:

```ts
for await (const frame of im.attachments.downloadStream(uploaded.attachment.guid)) {
  if (frame.type === "header") {
    console.log(frame.info.mimeType, frame.info.uti);
  }
  if (frame.type === "primaryChunk") {
    // append frame.data
  }
}
```

Live Photo companions transfer over HTTP: `attachments.upload(...)` with a
`companion` sends `multipart/form-data` (`file` + `companion` parts), and
`downloadStream(...)` yields the v1 frame sequence — a header frame carrying
`companionInfo`, the primary chunks, then the `companionChunk` frames fetched
from the middleware's `/v1/attachments/{guid}/companion` route.

`7z` and `rar` are not currently listed as tested formats because the current
server test workspace does not include real encoders for those archive types.
Fake files are not treated as supported fixtures.

## Chat Backgrounds

Chat backgrounds are not general attachments. They use chat GUIDs and raw image
bytes:

```ts
await im.chats.setBackground(
  "any;-;alice@example.com",
  await readFile("photo.jpg")
);

const present = await im.chats.hasBackground("any;-;alice@example.com");

await im.chats.removeBackground("any;-;alice@example.com");
```

Supported and live-tested background image MIME types:

- `image/jpeg`
- `image/png`
- `image/heic`
- `image/heif`

Callers do not pass a MIME type. The server infers the format from the bytes and
rejects `image/gif`, `image/webp`, `image/avif`, `image/tiff`, `image/bmp`, and
`image/svg+xml` for chat backgrounds. Those formats may still be uploaded and
sent as normal attachments; the background pipeline is stricter because the
server converts the input image into Apple's background package format.

Multipart sends are atomic and can mix text, mentions, and uploaded
attachments:

```ts
await im.messages.sendMultipart(chatGuid, [
  { text: "look at this " },
  { text: "@Alice", mentionedAddress: "alice@example.com" },
  {
    attachmentGuid: uploaded.attachment.guid,
    attachmentName: "photo.jpg",
  },
]);
```

## Mutate Messages

```ts
import { readFile } from "node:fs/promises";

await im.messages.edit(chatGuid, sent.guid, "updated text");
await im.messages.unsend(chatGuid, sent.guid);

await im.messages.setReaction(chatGuid, sent.guid, { kind: "love" }, true);
await im.messages.setReaction(chatGuid, sent.guid, { kind: "love" }, false);

const sticker = await im.attachments.upload({
  fileName: "sticker.png",
  data: await readFile("sticker.png"),
});

await im.messages.placeSticker(chatGuid, sent.guid, sticker.attachment.guid, {
  x: 120,
  y: 90,
});
```

For multipart messages, pass `partIndex` in mutation options to target one
bubble.

## Read Messages

```ts
const message = await im.messages.get(sent.guid);

const recent = await im.messages.listRecent({ pageSize: 25 });
const inChat = await im.messages.listInChat(chatGuid, {
  pageSize: 25,
  before: new Date(),
});
```

`pageSize`, when provided, must be between `1` and `100`.

## Inbound events

The HTTP client is outbound-only. It has no client-held event streams —
long-lived gRPC streams don't exist on `fetch`-only runtimes, so over HTTP
inbound delivery is the platform's job, not the client's. (The
`subscribeEvents(...)` / `watch(...)` / `events.catchUp(...)` streaming APIs
remain available on the [gRPC transport](#grpc).)

Over HTTP, to receive messages and other events, register a **webhook** for
your project (via Spectrum) and reply from your handler using this SDK. A
typical Cloudflare Worker:

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const event = await request.json();
    if (event.type === "message.received") {
      const im = createHttpClient({
        address: env.IMESSAGE_HTTP_ADDRESS,
        token: () => mintToken(env),
      });
      await im.messages.sendText(event.chat.guid, "got it!");
    }
    return new Response("ok");
  },
};
```

Transport adapters that already receive an encoded
`CatchUpEventsResponse` frame can map it through the same public event model
without importing generated protobuf internals:

```ts
import { decodeCatchUpEvent } from "@photon-ai/advanced-imessage";

const event = decodeCatchUpEvent(frameBytes);
if (event?.type === "message.received") {
  console.log(event.message.guid);
}
```

Heartbeat and payload-less frames return `undefined`; errors reported by the
generated protobuf decoder propagate to the caller.

Write responses remain authoritative: use the return value of a send/mutate
call as the result of that write, not a later event.

`downloadStream(...)` still returns a `TypedEventStream<T>` (backed by the
HTTP response stream). Streams support `for await`, `.on(...)`,
`.filter(...)`, `.map(...)`, `.take(...)`, `.close()`, and `await using`.

## Other Resources

```ts
await im.addresses.get("alice@example.com");
await im.addresses.isIMessageAvailable("alice@example.com");
await im.addresses.isFocusSilenced("alice@example.com");

const created = await im.chats.create(["alice@example.com"], {
  message: "hello",
});

await im.chats.markRead(created.chat.guid);
await im.chats.setTyping(created.chat.guid, true);

const group = await im.chats.create(["alice@example.com", "bob@example.com"]);

await im.groups.setDisplayName(group.chat.guid, "Weekend");
await im.groups.addParticipants(group.chat.guid, ["carol@example.com"]);
await im.groups.getIcon(group.chat.guid);

const poll = await im.polls.create(created.chat.guid, "Lunch?", [
  "Sushi",
  "Pizza",
]);

await im.polls.vote(poll.pollMessageGuid, poll.options[0]!.optionIdentifier);

await im.locations.list();
await im.locations.get("alice@example.com");
```

## Errors

Server errors are mapped to SDK error classes:

```ts
import {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@photon-ai/advanced-imessage";

try {
  await im.messages.sendText(chatGuid, "hello");
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(error.retryable, error.context);
  }
  if (error instanceof NotFoundError) {
    console.log(error.code);
  }
  if (error instanceof AuthenticationError) {
    console.log("refresh credentials");
  }
  if (error instanceof ValidationError) {
    console.log(error.context);
  }
}
```

## Client Options

```ts
const im = createHttpClient({
  address: "http://localhost:8080",
  token: "api-token",
  timeout: 10_000,
  retry: { maxAttempts: 4, initialDelay: 200, maxDelay: 5_000 },
  autoIdempotency: true,
});
```

`timeout` applies per call. `retry` retries only failures the server
explicitly marked retryable, with exponential backoff and jitter; the
idempotency key (when enabled) is generated once per logical call and reused
across attempts, so retries dedupe server-side. `autoIdempotency` adds the
key only to mutating calls.

For dedupe across *client* restarts, pass `clientMessageId` in a send's
options — the server rejects a repeated `clientMessageId` with a
`duplicateMessage` error, which means the original send succeeded.

## Development

```bash
bun install
bun run check
bun run lint
bun test
bun run build
```

The repo is a bun-workspaces monorepo; only `packages/advanced-imessage`
publishes to npm — it bundles the private workspace packages:

- `packages/core` — shared types, errors, streaming, proto↔public mapper,
  generated proto codecs
- `packages/http` — the fetch transport and the live resources
- `packages/grpc` — the v1-compatible gRPC transport behind a lazy façade

`bun run build` regenerates protobuf output from
[`buf.build/photon-hq/imessage`](https://buf.build/photon-hq/imessage), the
canonical source published by the server's CI — pinned to a BSR commit in
`buf.gen.yaml`; CI fails if committed codegen drifts from the pin — and
builds `packages/advanced-imessage/dist/`.

`bun run generate:http` regenerates the
HTTP route client (`packages/http/src/generated/http`) from the middleware's
OpenAPI spec (`gen/openapi/imessage.swagger.json`). After a build,
`bun test tests/dist` gates the published artifact: single class identity
across entrypoints and no static `nice-grpc` in the index/http graphs.
CI also bundles the SDK for workerd and boots it (`tests/workerd`), so a
Workers-hostile dependency cannot land unnoticed.
