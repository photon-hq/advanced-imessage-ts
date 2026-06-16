import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

const edited = await im.messages.edit(chat, messageGuid, "edited text");

console.log("guid:", edited.guid);
console.log("text:", edited.content.text);

await im.close();
