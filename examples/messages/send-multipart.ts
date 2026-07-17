import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

const message = await im.messages.sendMultipart(chat, [
  { text: "hello " },
  { text: "@alice", mentionedAddress: "alice@example.com" },
]);

console.log("guid:", message.guid);

await im.close();
