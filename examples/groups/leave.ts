import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;+;group-chat-guid";

await im.groups.leave(chat);

console.log("left group:", chat);

await im.close();
