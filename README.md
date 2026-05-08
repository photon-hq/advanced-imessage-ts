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
