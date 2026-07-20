import { describe, expect, it } from "bun:test";
import { ChatServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/chat_service";
import { createServer } from "nice-grpc";
import { createGrpcClients } from "../src/v1/transport/grpc-client.ts";

const SetBackgroundServiceDefinition = {
  name: ChatServiceDefinition.name,
  fullName: ChatServiceDefinition.fullName,
  methods: {
    setBackground: ChatServiceDefinition.methods.setBackground,
  },
} as const;

describe("createGrpcClients", () => {
  it("supports concurrent large unary requests on Bun 1.3.14", async () => {
    let received = 0;
    const server = createServer({
      "grpc.max_receive_message_length": 100 * 1024 * 1024,
    });
    server.add(SetBackgroundServiceDefinition, {
      async setBackground() {
        received += 1;
        return {};
      },
    });

    const port = await server.listen("127.0.0.1:0");
    const clients = createGrpcClients({
      address: `127.0.0.1:${port}`,
      tls: false,
    });

    try {
      const data = new Uint8Array(4 * 1024 * 1024);
      await Promise.all([
        clients.chats.setBackground({ chatGuid: "any;-;+1", data }),
        clients.chats.setBackground({ chatGuid: "any;-;+1", data }),
      ]);

      expect(received).toBe(2);
    } finally {
      clients.channel.close();
      clients.streamChannel.close();
      await server.shutdown();
    }
  });
});
