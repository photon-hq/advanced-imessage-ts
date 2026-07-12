import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const address = "alice@example.com";

const silenced = await im.addresses.isFocusSilenced(address);

console.log(
  `local Focus would silence notifications from ${address}:`,
  silenced
);

await im.close();
