import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
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
