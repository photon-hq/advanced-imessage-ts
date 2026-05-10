# @photon-ai/advanced-imessage

TypeScript SDK for the v2 Advanced iMessage server.

The SDK is intentionally thin: each resource method maps to one server RPC,
returns handwritten SDK types, and keeps reconnect / catch-up behavior explicit.
Generated protobuf types are not part of the public API.

## Install

```bash
bun add @photon-ai/advanced-imessage
```

Node.js `>=18.17` is supported. The package is ESM-only.

## Connect

```ts
import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: process.env.IMESSAGE_TOKEN!,
  tls: false,
});

await im.close();
```

`token` may also be an async function when credentials rotate:

```ts
const im = createClient({
  address: "imessage.example.com:443",
  token: async () => process.env.IMESSAGE_TOKEN!,
});
```

`tls` defaults to `true`. Set `tls: false` only for local development.

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
frame is metadata, followed by primary payload chunks and, for Live Photos,
companion payload chunks:

```ts
for await (const frame of im.attachments.downloadStream(uploaded.attachment.guid)) {
  if (frame.type === "header") {
    console.log(frame.info.mimeType, frame.info.uti);
  }
  if (frame.type === "primaryChunk") {
    // append frame.data
  }
  if (frame.type === "companionChunk") {
    // append Live Photo companion bytes
  }
}
```

Live Photo upload uses the same `attachments.upload(...)` method with a
companion. The supported and tested Live Photo shape is a HEIC/HEIF primary
image plus a QuickTime MOV companion video:

```ts
const livePhoto = await im.attachments.upload({
  fileName: "live_photo.HEIC",
  data: await readFile("live_photo.HEIC"),
  companion: {
    data: await readFile("live_photo.MOV"),
  },
});

await im.messages.sendAttachment(chatGuid, livePhoto.attachment.guid);
```

For Live Photos:

- The primary should be a HEIC/HEIF image, normally `.HEIC`, `.heic`, `.HEIF`,
  or `.heif`.
- The companion must be a QuickTime `.MOV` / `.mov` video.
- Do not use a `.mov` primary filename; the server stores the companion as a
  sidecar with the same stem and a `.mov` extension, so that collides.
- The SDK fixes the companion kind to `"live-photo-video"`; callers only pass
  companion bytes.

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
const message = await im.messages.get(chatGuid, sent.guid);

const recent = await im.messages.listRecent({ pageSize: 25 });
const inChat = await im.messages.listInChat(chatGuid, {
  pageSize: 25,
  before: new Date(),
});
```

`pageSize`, when provided, must be between `1` and `100`.

## Streams and Catch-Up

Live streams are observation APIs. They do not hide reconnect loops and they do
not replace write responses. Use the response from a write call as the
authoritative result for that write.

Persist the latest fully handled `event.sequence`. After a disconnect, replay
missed durable events with `events.catchUp(since)` before opening a new live
stream.

```ts
let since: number | undefined;

for await (const event of im.events.catchUp(since)) {
  if (event.type === "catchup.complete") {
    since = event.headSequence;
    break;
  }

  console.log("replayed", event.type, event.sequence);
  since = event.sequence;
}

for await (const event of im.messages.subscribeEvents({ chat: chatGuid })) {
  console.log("live", event.type, event.sequence);
  since = event.sequence;
}
```

Every `subscribeEvents(...)`, `downloadStream(...)`, and `locations.watch(...)`
call returns a `TypedEventStream<T>`. Streams support `for await`, `.on(...)`,
`.filter(...)`, `.map(...)`, `.take(...)`, `.close()`, and `await using`.

```ts
const stream = im.messages.subscribeEvents();

const stop = stream.on(
  (event) => {
    console.log(event.type, event.sequence);
  },
  (error) => {
    console.error(error);
  }
);

stop();
```

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
const im = createClient({
  address: "127.0.0.1:50051",
  token: "api-token",
  tls: false,
  timeout: 10_000,
  retry: { maxAttempts: 4, initialDelay: 200, maxDelay: 5_000 },
  autoIdempotency: true,
});
```

`timeout` and `retry` apply to unary RPCs. Streaming RPCs are left open and are
not retried automatically. `autoIdempotency` adds an idempotency key only to
mutating RPCs.

## Development

```bash
bun install
bun run check
bun run lint
bun test
bun run build
```

`bun run build` regenerates protobuf output and builds `dist/`.
