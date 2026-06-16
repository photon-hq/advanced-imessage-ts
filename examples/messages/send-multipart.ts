import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

const message = await im.messages.sendMultipart(chat, [
  { text: "hello " },
  { text: "@alice", mentionedAddress: "alice@example.com" },
]);

console.log("guid:", message.guid);

await im.close();
