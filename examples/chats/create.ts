import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const address = "alice@example.com";

const direct = await im.chats.create([address]);
console.log("created chat:", direct.chat.guid);

const greeting = await im.chats.create([address], {
  message: "hello from SDK",
});

console.log("opening message:", greeting.initialMessage?.guid);

await im.close();
