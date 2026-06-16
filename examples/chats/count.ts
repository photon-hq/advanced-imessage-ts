import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const active = await im.chats.count();

console.log("active chats:", active);

const all = await im.chats.count({ includeArchived: true });

console.log("all chats (incl. archived):", all);

await im.close();
