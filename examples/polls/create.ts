import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;+;group-guid";

const poll = await im.polls.create(chat, "Lunch?", ["Sushi", "Pizza"]);

console.log("pollMessageGuid:", poll.pollMessageGuid);

await im.close();
