import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const page = await im.messages.listRecent({ pageSize: 10 });

console.log("count:", page.messages.length);
console.log("nextPageToken:", page.nextPageToken);

await im.close();
