import { createClient } from "@photon-ai/advanced-imessage";

const im = createClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const stream = im.locations.watch();

setTimeout(() => {
  stream.close();
}, 5000);

for await (const update of stream) {
  console.log(update.location.address, update.sourceSequence);
}

await im.close();
