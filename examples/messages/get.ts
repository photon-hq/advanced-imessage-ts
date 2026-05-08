import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

const message = await im.messages.get(chat, messageGuid);

console.log("guid:", message.guid);
console.log("text:", message.content.text);

await im.close();
