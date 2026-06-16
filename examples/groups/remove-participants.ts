import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
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
