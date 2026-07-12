import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

const reacted = await im.messages.setReaction(
  chat,
  messageGuid,
  {
    kind: "love",
  },
  true
);

console.log("reacted:", reacted.guid);

const cleared = await im.messages.setReaction(
  chat,
  messageGuid,
  {
    kind: "love",
  },
  false
);

console.log("cleared:", cleared.guid);

await im.close();
