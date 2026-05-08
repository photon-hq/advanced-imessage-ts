import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const stream = im.chats.subscribeEvents({ chat });

setTimeout(() => {
  stream.close();
}, 5000);

for await (const event of stream) {
  console.log(event.type, event.chatGuid);
}

await im.close();
