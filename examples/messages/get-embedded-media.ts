import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const messageGuid = "digital-touch-message-guid";

const media = await im.messages.getEmbeddedMedia(chat, messageGuid);

console.log("mimeType:", media.mimeType);
console.log("byteLength:", media.data.length);

await im.close();
