import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const messageGuid = "message-guid";

const message = await im.messages.get(messageGuid);

console.log("guid:", message.guid);
console.log("text:", message.content.text);

await im.close();
