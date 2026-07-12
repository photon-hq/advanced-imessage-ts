import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;+;group-chat-guid";

const updated = await im.groups.addParticipants(chat, ["carol@example.com"]);

console.log("guid:", updated.guid);
console.log(
  "participants:",
  updated.participants.map((participant) => participant.address)
);

await im.close();
