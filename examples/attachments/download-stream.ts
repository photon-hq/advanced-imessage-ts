import { createHttpClient } from "@photon-ai/advanced-imessage";

const im = createHttpClient({
  address: "http://localhost:8080", // the HTTP middleware
  token: "dev-token",
});

const attachmentGuid = "attachment-guid";

for await (const frame of im.attachments.downloadStream(attachmentGuid)) {
  console.log(frame.type);
}

await im.close();
