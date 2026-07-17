import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const pollMessageGuid = "poll-message-guid";

const poll = await im.polls.addOption(pollMessageGuid, "Tacos");

console.log("options:", poll.options.length);

await im.close();
