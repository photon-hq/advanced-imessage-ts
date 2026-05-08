import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const locations = await im.locations.list();

console.log("count:", locations.length);

await im.close();
