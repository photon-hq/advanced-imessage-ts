import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const pollMessageGuid = "poll-message-guid";
const optionIdentifier = "option-id";

const poll = await im.polls.vote(pollMessageGuid, optionIdentifier);

console.log("votes:", poll.votes);

await im.close();
