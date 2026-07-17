import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

await im.groups.leave(chat);

console.log("left group:", chat);

await im.close();
