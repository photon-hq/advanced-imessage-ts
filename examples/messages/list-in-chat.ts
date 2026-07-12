import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";

const page = await im.messages.listInChat(chat, { pageSize: 10 });

console.log("count:", page.messages.length);
console.log("nextPageToken:", page.nextPageToken);

await im.close();
