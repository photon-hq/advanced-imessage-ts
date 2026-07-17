import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const address = "alice@example.com";

const silenced = await im.addresses.isFocusSilenced(address);

console.log(
  `local Focus would silence notifications from ${address}:`,
  silenced
);

await im.close();
