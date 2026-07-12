import { createGrpcClient } from "@photon-ai/advanced-imessage/grpc";

const im = createGrpcClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const stream = im.polls.subscribeEvents();

setTimeout(() => {
  stream.close();
}, 5000);

for await (const event of stream) {
  console.log(event.type, event.sequence);
}

await im.close();
