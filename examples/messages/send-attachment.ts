import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const attachment = "attachment-guid";

const message = await im.messages.sendAttachment(chat, attachment);

console.log("guid:", message.guid);

await im.close();
