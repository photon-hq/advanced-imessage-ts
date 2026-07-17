import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const location = await im.locations.get("alice@example.com");

console.log("found:", Boolean(location));

await im.close();
