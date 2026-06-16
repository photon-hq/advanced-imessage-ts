import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
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
