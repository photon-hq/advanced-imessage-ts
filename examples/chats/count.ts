import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const active = await im.chats.count();

console.log("active chats:", active);

const all = await im.chats.count({ includeArchived: true });

console.log("all chats (incl. archived):", all);

await im.close();
