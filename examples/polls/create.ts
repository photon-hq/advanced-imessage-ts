import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;+;group-guid";

const poll = await im.polls.create(chat, "Lunch?", ["Sushi", "Pizza"]);

console.log("pollMessageGuid:", poll.pollMessageGuid);

await im.close();
