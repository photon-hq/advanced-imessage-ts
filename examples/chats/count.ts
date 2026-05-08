import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const active = await im.chats.count();

console.log("active chats:", active);

const all = await im.chats.count({ includeArchived: true });

console.log("all chats (incl. archived):", all);

await im.close();
