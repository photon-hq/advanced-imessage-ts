import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
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
