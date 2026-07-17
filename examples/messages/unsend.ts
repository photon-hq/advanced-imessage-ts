import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

await im.messages.unsend(chat, messageGuid);

console.log("message unsent");

await im.close();
