import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

await im.groups.leave(chat);

console.log("left group:", chat);

await im.close();
