import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const attachmentGuid = "attachment-guid";

const attachment = await im.attachments.get(attachmentGuid);

console.log("mimeType:", attachment.mimeType);

await im.close();
