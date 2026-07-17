import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

const edited = await im.messages.edit(chat, messageGuid, "edited text");

console.log("guid:", edited.guid);
console.log("text:", edited.content.text);

await im.close();
