import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const pollMessageGuid = "poll-message-guid";

const poll = await im.polls.get(pollMessageGuid);

console.log("title:", poll.title);

await im.close();
