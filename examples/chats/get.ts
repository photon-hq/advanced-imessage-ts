import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const chat = await im.chats.get("any;-;alice@example.com");
console.log(chat);

await im.close();
