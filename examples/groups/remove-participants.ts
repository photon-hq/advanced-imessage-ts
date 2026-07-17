import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;+;group-chat-guid";

const updated = await im.groups.removeParticipants(chat, ["carol@example.com"]);

console.log("guid:", updated.guid);
console.log(
  "participants:",
  updated.participants.map((participant) => participant.address)
);

await im.close();
