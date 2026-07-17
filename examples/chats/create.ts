import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const address = "alice@example.com";

const direct = await im.chats.create([address]);
console.log("created chat:", direct.chat.guid);

const greeting = await im.chats.create([address], {
  message: "hello from SDK",
});

console.log("opening message:", greeting.initialMessage?.guid);

await im.close();
