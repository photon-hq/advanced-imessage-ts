import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const pollMessageGuid = "poll-message-guid";

const poll = await im.polls.get(pollMessageGuid);

console.log("title:", poll.title);

await im.close();
