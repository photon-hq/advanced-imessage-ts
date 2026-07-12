import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";

const message = await im.messages.sendMultipart(chat, [
  { text: "hello " },
  { text: "@alice", mentionedAddress: "alice@example.com" },
]);

console.log("guid:", message.guid);

await im.close();
