import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

const edited = await im.messages.edit(chat, messageGuid, "edited text");

console.log("guid:", edited.guid);
console.log("text:", edited.content.text);

await im.close();
