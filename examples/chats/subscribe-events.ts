import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
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
