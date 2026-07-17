import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "digital-touch-message-guid";

const media = await im.messages.getEmbeddedMedia(chat, messageGuid);

console.log("mimeType:", media.mimeType);
console.log("byteLength:", media.data.length);

await im.close();
