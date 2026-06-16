import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

const icon = await im.groups.getIcon(chat);

console.log("mimeType:", icon.mimeType);
console.log("byteLength:", icon.data.length);

await im.close();
