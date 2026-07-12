import { createGrpcClient } from "@photon-ai/advanced-imessage/grpc";

const im = createGrpcClient({
  address: "127.0.0.1:50051",
  token: "dev-token",
  tls: false,
});

const chat = "any;-;alice@example.com";
const stream = im.messages.subscribeEvents({ chat });

setTimeout(() => {
  stream.close();
}, 5000);

for await (const event of stream) {
  console.log(event.type, event.chatGuid);
}

await im.close();
