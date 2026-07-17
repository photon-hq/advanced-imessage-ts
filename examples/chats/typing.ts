import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

await im.chats.setTyping(chat, true);
console.log("typing started:", chat);

await im.chats.setTyping(chat, false);
console.log("typing stopped:", chat);

await im.close();
