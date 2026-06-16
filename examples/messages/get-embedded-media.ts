import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "digital-touch-message-guid";

const media = await im.messages.getEmbeddedMedia(chat, messageGuid);

console.log("mimeType:", media.mimeType);
console.log("byteLength:", media.data.length);

await im.close();
