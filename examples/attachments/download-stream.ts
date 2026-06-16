import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const attachmentGuid = "attachment-guid";

for await (const frame of im.attachments.downloadStream(attachmentGuid)) {
  console.log(frame.type);
}

await im.close();
