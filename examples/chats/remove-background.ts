import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";

const updated = await im.chats.removeBackground(chat);
console.log("background removed:", updated.guid);

await im.close();
