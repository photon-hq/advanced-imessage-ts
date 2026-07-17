import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

const icon = await im.groups.getIcon(chat);

console.log("mimeType:", icon.mimeType);
console.log("byteLength:", icon.data.length);

await im.close();
