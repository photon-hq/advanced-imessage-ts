import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

const renamed = await im.groups.setDisplayName(chat, "Weekend Plan");

console.log("guid:", renamed.guid);
console.log("displayName:", renamed.displayName);

await im.close();
