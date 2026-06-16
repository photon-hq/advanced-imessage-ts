import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = await im.chats.get("any;-;alice@example.com");
console.log(chat);

await im.close();
