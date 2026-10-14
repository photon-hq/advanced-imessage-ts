import { describe, expect, it } from "bun:test";
import { ChatServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/chat_service";
import { MessageServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/message_service";
import { createServer, ServerError, Status } from "nice-grpc";
import { createGrpcClients } from "../src/v1/transport/grpc-client.ts";
import { readMetadataValue } from "../src/v1/utils/grpc-metadata.ts";

const SetBackgroundServiceDefinition = {
  name: ChatServiceDefinition.name,
  fullName: ChatServiceDefinition.fullName,
  methods: {
    setBackground: ChatServiceDefinition.methods.setBackground,
  },
} as const;

const SendTextServiceDefinition = {
  name: MessageServiceDefinition.name,
  fullName: MessageServiceDefinition.fullName,
  methods: {
    sendTextMessage: MessageServiceDefinition.methods.sendTextMessage,
  },
} as const;

describe("createGrpcClients", () => {
  it("retries server-marked failures with one idempotency key per logical send", async () => {
    const keys: unknown[] = [];
    const authorizations: unknown[] = [];
    let tokenCalls = 0;
    let trailers = 0;
    const server = createServer();
    server.add(SendTextServiceDefinition, {
      async sendTextMessage(_request, context) {
        keys.push(context.metadata.get("x-idempotency-key"));
        authorizations.push(context.metadata.get("authorization"));
        if (keys.length < 3) {
          context.trailer.set("x-retryable", "true");
          throw new ServerError(Status.UNAVAILABLE, "temporary route failure");
        }
        return { message: { guid: "delivered-message" } };
      },
    });
    const port = await server.listen("127.0.0.1:0");
    const clients = createGrpcClients({
      address: `127.0.0.1:${port}`,
      tls: false,
      autoIdempotency: true,
      retry: { maxAttempts: 3, initialDelay: 0, maxDelay: 0 },
      timeout: 2000,
      token: async () => `token-${++tokenCalls}`,
    });

    try {
      const response = await clients.messages.sendTextMessage(
        { chatGuid: "any;-;+15555550100", text: "first send" },
        {
          onTrailer: () => {
            trailers += 1;
          },
        }
      );
      expect(response.message?.guid).toBe("delivered-message");
      expect(keys).toHaveLength(3);
      expect(typeof keys[0]).toBe("string");
      expect(keys[0]).toBeTruthy();
      expect(new Set(keys).size).toBe(1);
      expect(authorizations).toEqual([
        "Bearer token-1",
        "Bearer token-2",
        "Bearer token-3",
      ]);
      expect(trailers).toBe(3);

      await clients.messages.sendTextMessage({
        chatGuid: "any;-;+15555550100",
        text: "second send",
      });
      expect(keys).toHaveLength(4);
      expect(keys[3]).not.toBe(keys[0]);
    } finally {
      clients.channel.close();
      clients.streamChannel.close();
      await server.shutdown();
    }
  });

  it("stops on a nonretryable trailer after a retryable failure", async () => {
    let attempts = 0;
    const server = createServer();
    server.add(SendTextServiceDefinition, {
      async sendTextMessage(_request, context) {
        attempts += 1;
        context.trailer.set("x-retryable", attempts === 1 ? "true" : "false");
        context.trailer.set("error-code", `route-error-${attempts}`);
        throw new ServerError(Status.UNAVAILABLE, "route failure");
      },
    });
    const port = await server.listen("127.0.0.1:0");
    const clients = createGrpcClients({
      address: `127.0.0.1:${port}`,
      tls: false,
      retry: { maxAttempts: 3, initialDelay: 0, maxDelay: 0 },
    });

    try {
      const result = await Promise.allSettled([
        clients.messages.sendTextMessage({
          chatGuid: "any;-;+15555550100",
          text: "send",
        }),
      ]);
      expect(attempts).toBe(2);
      expect(result[0]?.status).toBe("rejected");
      if (result[0]?.status === "rejected") {
        expect(readMetadataValue(result[0].reason, "x-retryable")).toBe(
          "false"
        );
        expect(readMetadataValue(result[0].reason, "error-code")).toBe(
          "route-error-2"
        );
      }
    } finally {
      clients.channel.close();
      clients.streamChannel.close();
      await server.shutdown();
    }
  });

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
