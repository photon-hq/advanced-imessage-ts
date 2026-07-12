import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const pollMessageGuid = "poll-message-guid";

const poll = await im.polls.get(pollMessageGuid);

console.log("title:", poll.title);

await im.close();
