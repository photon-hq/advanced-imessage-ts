import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

const renamed = await im.groups.setDisplayName(chat, "Weekend Plan");

console.log("guid:", renamed.guid);
console.log("displayName:", renamed.displayName);

await im.close();
