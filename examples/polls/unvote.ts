import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const pollMessageGuid = "poll-message-guid";

const poll = await im.polls.unvote(pollMessageGuid);

console.log("votes:", poll.votes.length);

await im.close();
