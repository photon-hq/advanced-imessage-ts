import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const pollMessageGuid = "poll-message-guid";
const optionIdentifier = "option-id";

const poll = await im.polls.vote(pollMessageGuid, optionIdentifier);

console.log("votes:", poll.votes);

await im.close();
