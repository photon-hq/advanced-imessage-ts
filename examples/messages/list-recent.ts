import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const page = await im.messages.listRecent({ pageSize: 10 });

console.log("count:", page.messages.length);
console.log("nextPageToken:", page.nextPageToken);

await im.close();
