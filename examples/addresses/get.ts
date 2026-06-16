import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const address = "alice@example.com";

const info = await im.addresses.get(address);

console.log(info);

await im.close();
