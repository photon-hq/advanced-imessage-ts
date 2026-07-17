import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

await im.groups.removeIcon(chat);

console.log("icon removed");

await im.close();
