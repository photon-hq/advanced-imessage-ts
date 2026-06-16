import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

await im.chats.setTyping(chat, true);
console.log("typing started:", chat);

await im.chats.setTyping(chat, false);
console.log("typing stopped:", chat);

await im.close();
