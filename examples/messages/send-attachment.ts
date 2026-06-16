import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const attachment = "attachment-guid";

const message = await im.messages.sendAttachment(chat, attachment);

console.log("guid:", message.guid);

await im.close();
