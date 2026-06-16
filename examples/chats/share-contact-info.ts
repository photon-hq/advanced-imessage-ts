import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

await im.chats.shareContactInfo(chat);
console.log("shared contact card:", chat);

await im.close();
