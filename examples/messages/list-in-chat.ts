import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

const page = await im.messages.listInChat(chat, { pageSize: 10 });

console.log("count:", page.messages.length);
console.log("nextPageToken:", page.nextPageToken);

await im.close();
