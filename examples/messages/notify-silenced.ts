import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const messageGuid = "message-guid";

await im.messages.notifySilenced(chat, messageGuid);

console.log("notified for:", messageGuid);

await im.close();
