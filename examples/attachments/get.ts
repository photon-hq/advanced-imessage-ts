import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const attachmentGuid = "attachment-guid";

const attachment = await im.attachments.get(attachmentGuid);

console.log("mimeType:", attachment.mimeType);

await im.close();
