import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const address = "alice@example.com";

const available = await im.addresses.isIMessageAvailable(address);

console.log(`${address} on iMessage:`, available);

await im.close();
