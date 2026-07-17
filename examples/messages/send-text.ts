import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

const message = await im.messages.sendText(chat, "hello from SDK");

console.log("guid:", message.guid);
console.log("text:", message.content.text);

await im.close();
