import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;+;group-chat-guid";

const icon = await im.groups.getIcon(chat);

console.log("mimeType:", icon.mimeType);
console.log("byteLength:", icon.data.length);

await im.close();
