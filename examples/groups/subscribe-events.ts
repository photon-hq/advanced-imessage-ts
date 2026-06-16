import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";
const stream = im.groups.subscribeEvents({ chat });

setTimeout(() => {
  stream.close();
}, 5000);

for await (const event of stream) {
  console.log(event.type, event.change);
}

await im.close();
