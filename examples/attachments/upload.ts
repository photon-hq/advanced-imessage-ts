import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const data = new Uint8Array([1, 2, 3]);

const uploaded = await im.attachments.upload({
  fileName: "demo.bin",
  data,
});

console.log("guid:", uploaded.attachment.guid);

await im.close();
