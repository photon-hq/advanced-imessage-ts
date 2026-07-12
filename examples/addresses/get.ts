import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const address = "alice@example.com";

const info = await im.addresses.get(address);

console.log(info);

await im.close();
