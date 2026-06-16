import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

await im.messages.unsend(chat, messageGuid);

console.log("message unsent");

await im.close();
