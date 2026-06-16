import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const address = "alice@example.com";

const silenced = await im.addresses.isFocusSilenced(address);

console.log(
  `local Focus would silence notifications from ${address}:`,
  silenced
);

await im.close();
