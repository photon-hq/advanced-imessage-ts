import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = await im.chats.get("any;-;alice@example.com");
console.log(chat);

await im.close();
