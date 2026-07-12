import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const attachmentGuid = "attachment-guid";

const attachment = await im.attachments.get(attachmentGuid);

console.log("mimeType:", attachment.mimeType);

await im.close();
