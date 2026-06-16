import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const pollMessageGuid = "poll-message-guid";
const optionIdentifier = "option-id";

const poll = await im.polls.vote(pollMessageGuid, optionIdentifier);

console.log("votes:", poll.votes);

await im.close();
