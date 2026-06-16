import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const data = new Uint8Array([1, 2, 3]);

const uploaded = await im.attachments.upload({
  fileName: "demo.bin",
  data,
});

console.log("guid:", uploaded.attachment.guid);

await im.close();
