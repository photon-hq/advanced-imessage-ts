import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";

const message = await im.messages.sendText(chat, "hello from SDK");

console.log("guid:", message.guid);
console.log("text:", message.content.text);

await im.close();
