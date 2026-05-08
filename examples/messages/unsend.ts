import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

const unsent = await im.messages.unsend(chat, messageGuid);

console.log("guid:", unsent.guid);
console.log("partCount:", unsent.partCount);
console.log("text:", unsent.content.text ?? null);

await im.close();
