import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const address = "alice@example.com";

const info = await im.addresses.get(address);

console.log(info);

await im.close();
