import { describe, expect, it } from "bun:test";
import { ChatServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/chat_service";
import { MessageServiceDefinition } from "@photon-ai/aim-core/generated/photon/imessage/v1/message_service";
import { createServer } from "nice-grpc";
import { ClientError, ServerError, Status } from "nice-grpc-common";
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

const SEND_REQUEST = { chatGuid: "any;-;+15555550100", text: "hello" };
const RETRY_OPTIONS = { maxAttempts: 3, initialDelay: 0, maxDelay: 0 };

describe("createGrpcClients", () => {
  it("retries trailer-marked sends with one idempotency key and fresh auth", async () => {
    const keys: Array<string | undefined> = [];
    const auth: Array<string | undefined> = [];
    let tokenCalls = 0;
    const server = createServer();
    server.add(SendTextServiceDefinition, {
      async sendTextMessage(_request, context) {
        keys.push(context.metadata.get("x-idempotency-key"));
        auth.push(context.metadata.get("authorization"));
        if (keys.length === 1) {
          context.trailer.set("x-retryable", "true");
          context.trailer.set("error-code", "serviceUnavailable");
          throw new ServerError(Status.UNAVAILABLE, "Please retry.");
        }
        return {};
      },
    });
    const port = await server.listen("127.0.0.1:0");
    const clients = createGrpcClients({
      address: `127.0.0.1:${port}`,
      tls: false,
      autoIdempotency: true,
      retry: RETRY_OPTIONS,
      async token() {
        tokenCalls += 1;
        return `token-${tokenCalls}`;
      },
    });
    try {
      await clients.messages.sendTextMessage(SEND_REQUEST);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toHaveLength(36);
      expect(keys[1]).toBe(keys[0]);
      expect(auth).toEqual(["Bearer token-1", "Bearer token-2"]);
    } finally {
      clients.channel.close();
      clients.streamChannel.close();
      await server.shutdown();
    }
  });

  it("preserves the final error trailers when retries are exhausted", async () => {
    let attempts = 0;
    const server = createServer();
    server.add(SendTextServiceDefinition, {
      async sendTextMessage(_request, context) {
        attempts += 1;
        context.trailer.set("x-retryable", "true");
        context.trailer.set("error-code", "serviceUnavailable");
        context.trailer.set("request-id", `attempt-${attempts}`);
        throw new ServerError(Status.UNAVAILABLE, "Please retry.");
      },
    });
    const port = await server.listen("127.0.0.1:0");
    const clients = createGrpcClients({
      address: `127.0.0.1:${port}`,
      tls: false,
      retry: RETRY_OPTIONS,
    });
    try {
      let caught: unknown;
      try {
        await clients.messages.sendTextMessage(SEND_REQUEST);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ClientError);
      expect(attempts).toBe(RETRY_OPTIONS.maxAttempts);
      expect(readMetadataValue(caught, "x-retryable")).toBe("true");
      expect(readMetadataValue(caught, "error-code")).toBe(
        "serviceUnavailable"
      );
      expect(readMetadataValue(caught, "request-id")).toBe("attempt-3");
    } finally {
      clients.channel.close();
      clients.streamChannel.close();
      await server.shutdown();
    }
  });

  it.each([
    undefined,
    "false",
  ])("does not retry UNAVAILABLE with x-retryable=%s", async (retryable) => {
    let attempts = 0;
    const server = createServer();
    server.add(SendTextServiceDefinition, {
      async sendTextMessage(_request, context) {
        attempts += 1;
        if (retryable !== undefined) {
          context.trailer.set("x-retryable", retryable);
        }
        throw new ServerError(Status.UNAVAILABLE, "Do not retry.");
      },
    });
    const port = await server.listen("127.0.0.1:0");
    const clients = createGrpcClients({
      address: `127.0.0.1:${port}`,
      tls: false,
      retry: RETRY_OPTIONS,
    });
    try {
      await expect(
        clients.messages.sendTextMessage(SEND_REQUEST)
      ).rejects.toBeInstanceOf(ClientError);
      expect(attempts).toBe(1);
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
