import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const attachment = "attachment-guid";

const message = await im.messages.sendAttachment(chat, attachment);

console.log("guid:", message.guid);

await im.close();
