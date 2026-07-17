import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const data = new Uint8Array([1, 2, 3]);

const uploaded = await im.attachments.upload({
  fileName: "demo.bin",
  data,
});

console.log("guid:", uploaded.attachment.guid);

await im.close();
