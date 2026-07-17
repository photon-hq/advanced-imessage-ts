import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const address = "alice@example.com";

const available = await im.addresses.isIMessageAvailable(address);

console.log(`${address} on iMessage:`, available);

await im.close();
