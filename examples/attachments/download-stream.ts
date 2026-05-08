import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const attachmentGuid = "attachment-guid";

for await (const frame of im.attachments.downloadStream(attachmentGuid)) {
  console.log(frame.type);
}

await im.close();
