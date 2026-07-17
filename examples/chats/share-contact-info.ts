import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

await im.chats.shareContactInfo(chat);
console.log("shared contact card:", chat);

await im.close();
