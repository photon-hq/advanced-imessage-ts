import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

const message = await im.messages.get(chat, messageGuid);

console.log("guid:", message.guid);
console.log("text:", message.content.text);

await im.close();
