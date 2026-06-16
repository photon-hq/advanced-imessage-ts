import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const location = await im.locations.get("alice@example.com");

console.log("found:", Boolean(location));

await im.close();
