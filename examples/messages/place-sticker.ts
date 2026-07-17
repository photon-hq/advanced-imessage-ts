import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";
const sticker = "attachment-guid";

const message = await im.messages.placeSticker(chat, messageGuid, sticker, {
  x: 120,
  y: 90,
});

console.log("guid:", message.guid);

await im.close();
