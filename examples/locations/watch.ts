import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  baseUrl: "https://staging-spectrum-imessage-web.photon.codes",
  token: "dev-token",
});

const stream = im.locations.watch();

setTimeout(() => {
  stream.close();
}, 5000);

for await (const update of stream) {
  console.log(update.location.address, update.sourceSequence);
}

await im.close();
