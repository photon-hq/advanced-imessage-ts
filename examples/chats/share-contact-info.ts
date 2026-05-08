import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";

await im.chats.shareContactInfo(chat);
console.log("shared contact card:", chat);

await im.close();
