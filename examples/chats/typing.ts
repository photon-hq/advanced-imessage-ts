import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";

await im.chats.setTyping(chat, true);
console.log("typing started:", chat);

await im.chats.setTyping(chat, false);
console.log("typing stopped:", chat);

await im.close();
