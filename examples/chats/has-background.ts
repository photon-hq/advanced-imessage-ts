import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = "any;-;alice@example.com";

const present = await im.chats.hasBackground(chat);
console.log("has background:", present);

await im.close();
