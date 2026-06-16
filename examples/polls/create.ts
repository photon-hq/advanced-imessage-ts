import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const chat = "any;+;group-guid";

const poll = await im.polls.create(chat, "Lunch?", ["Sushi", "Pizza"]);

console.log("pollMessageGuid:", poll.pollMessageGuid);

await im.close();
