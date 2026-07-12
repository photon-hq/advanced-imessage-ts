import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;+;group-chat-guid";

await im.groups.removeIcon(chat);

console.log("icon removed");

await im.close();
