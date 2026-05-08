import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const address = "alice@example.com";

const available = await im.addresses.isIMessageAvailable(address);

console.log(`${address} on iMessage:`, available);

await im.close();
