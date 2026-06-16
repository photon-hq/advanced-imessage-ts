import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
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
