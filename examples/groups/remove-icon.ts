import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

await im.groups.removeIcon(chat);

console.log("icon removed");

await im.close();
