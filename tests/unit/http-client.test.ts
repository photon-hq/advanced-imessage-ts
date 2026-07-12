import { afterEach, describe, expect, it } from "bun:test";
import {
  ConnectionError,
  NotFoundError,
  ValidationError,
} from "../../src/errors/imessage-error.ts";
import { createHttpClients } from "../../src/transport/http-client.ts";

/**
 * The transport's whole job: ts-proto message → HTTP request → ts-proto
 * message, with auth/retry/idempotency/errors handled on the way. These
 * tests mock global fetch and assert the wire shapes.
 */

interface Captured {
  body?: unknown;
  headers: Headers;
  method: string;
  url: URL;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(
  responses: Array<{ status: number; body: unknown }>
): Captured[] {
  const captured: Captured[] = [];
  let call = 0;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const entry: Captured = {
      headers: request.headers,
      method: request.method,
      url: new URL(request.url),
    };
    if (request.method === "POST") {
      const text = await request.text();
      try {
        entry.body = JSON.parse(text);
      } catch {
        entry.body = text;
      }
    }
    captured.push(entry);
    const spec = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (!spec) {
      throw new Error("no mock response configured");
    }
    return new Response(JSON.stringify(spec.body), {
      status: spec.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return captured;
}

function clients(options: Record<string, unknown> = {}) {
  return createHttpClients({
    address: "middleware.test",
    token: "test-jwt",
    ...options,
  });
}

describe("http transport", () => {
  it("POSTs proto3-JSON bodies with bearer auth", async () => {
    const captured = mockFetch([
      { status: 200, body: { message: { guid: "m-1", isFromMe: true } } },
    ]);
    const response = await clients().messages.sendTextMessage({
      chatGuid: "iMessage;-;+15551234567",
      text: "hello",
    });
    const call = captured[0];
    expect(call?.method).toBe("POST");
    expect(call?.url.pathname).toBe("/v1/messages:sendText");
    expect(call?.url.protocol).toBe("https:");
    expect(call?.headers.get("authorization")).toBe("Bearer test-jwt");
    expect(call?.body).toEqual({
      chatGuid: "iMessage;-;+15551234567",
      text: "hello",
    });
    // fromJSON round-trip into the ts-proto shape
    expect(response.message?.guid).toBe("m-1");
    expect(response.message?.isFromMe).toBe(true);
  });

  it("resolves async token providers per call", async () => {
    mockFetch([{ status: 200, body: { chat: { guid: "c" } } }]);
    let minted = 0;
    const captured = mockFetch([{ status: 200, body: { chat: {} } }]);
    const withTokenFn = clients({
      token: () => {
        minted += 1;
        return Promise.resolve(`fresh-${minted}`);
      },
    });
    await withTokenFn.chats.getChat({ chatGuid: "any;-;x" });
    expect(captured[0]?.headers.get("authorization")).toBe("Bearer fresh-1");
  });

  it("sends x-photon-server on every call when `server` is set", async () => {
    const captured = mockFetch([
      { status: 200, body: { message: {} } },
      { status: 200, body: { attachment: { guid: "spc-att-1" } } },
    ]);
    const dedicated = clients({ server: "instance-abc" });
    await dedicated.messages.sendTextMessage({ chatGuid: "x", text: "y" });
    await dedicated.attachments.uploadAttachment({
      fileName: "a.jpg",
      data: new Uint8Array([1]),
      companion: undefined,
    });
    // Both the generated JSON routes and the raw-bytes routes carry it.
    expect(captured[0]?.headers.get("x-photon-server")).toBe("instance-abc");
    expect(captured[1]?.headers.get("x-photon-server")).toBe("instance-abc");
  });

  it("omits x-photon-server by default (shared mode)", async () => {
    const captured = mockFetch([{ status: 200, body: { message: {} } }]);
    await clients().messages.sendTextMessage({ chatGuid: "x", text: "y" });
    expect(captured[0]?.headers.get("x-photon-server")).toBeNull();
  });

  it("maps GET requests to query params with proto3-JSON scalars", async () => {
    const captured = mockFetch([
      { status: 200, body: { messages: [], nextPageToken: "tok" } },
    ]);
    await clients().messages.listChatMessages({
      chatGuid: "any;-;+15551234567",
      pageSize: 5,
      isRead: true,
      after: new Date("2026-07-01T00:00:00Z"),
    });
    const call = captured[0];
    expect(call?.method).toBe("GET");
    expect(call?.url.pathname).toBe("/v1/messages:listByChat");
    const params = call?.url.searchParams;
    expect(params?.get("chatGuid")).toBe("any;-;+15551234567");
    expect(params?.get("pageSize")).toBe("5");
    expect(params?.get("isRead")).toBe("true");
    expect(params?.get("after")).toBe("2026-07-01T00:00:00.000Z");
  });

  it("puts path-safe GUIDs in the URL path", async () => {
    const captured = mockFetch([{ status: 200, body: { message: {} } }]);
    await clients().messages.getMessage({ messageGuid: "spc-abc" });
    expect(captured[0]?.url.pathname).toBe("/v1/messages/spc-abc");
    expect(captured[0]?.url.searchParams.size).toBe(0);
  });

  it("maps middleware error bodies to typed errors", async () => {
    mockFetch([
      {
        status: 404,
        body: {
          code: "not_found",
          message: "Message does not exist",
          errorCode: "messageNotFound",
          retryable: false,
          source: "upstream",
        },
      },
    ]);
    await expect(
      clients().messages.getMessage({ messageGuid: "spc-gone" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("retries only when the server marked the error retryable", async () => {
    const captured = mockFetch([
      {
        status: 503,
        body: { code: "unavailable", message: "busy", retryable: true },
      },
      { status: 200, body: { message: { guid: "m-2" } } },
    ]);
    const response = await clients({
      retry: { initialDelay: 1, maxDelay: 2 },
    }).messages.sendTextMessage({ chatGuid: "x", text: "y" });
    expect(captured.length).toBe(2);
    expect(response.message?.guid).toBe("m-2");
  });

  it("does not retry non-retryable failures", async () => {
    const captured = mockFetch([
      {
        status: 400,
        body: { code: "invalid_argument", message: "bad", retryable: false },
      },
    ]);
    await expect(
      clients({ retry: true }).messages.sendTextMessage({
        chatGuid: "x",
        text: "y",
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(captured.length).toBe(1);
  });

  it("reuses one idempotency key across retry attempts", async () => {
    const captured = mockFetch([
      {
        status: 503,
        body: { code: "unavailable", message: "busy", retryable: true },
      },
      { status: 200, body: { message: {} } },
    ]);
    await clients({
      autoIdempotency: true,
      retry: { initialDelay: 1, maxDelay: 2 },
    }).messages.sendTextMessage({ chatGuid: "x", text: "y" });
    const first = captured[0]?.headers.get("x-idempotency-key");
    const second = captured[1]?.headers.get("x-idempotency-key");
    expect(first).toBeTruthy();
    expect(second).toBe(first ?? "");
  });

  it("omits the idempotency key on reads", async () => {
    const captured = mockFetch([{ status: 200, body: { message: {} } }]);
    await clients({ autoIdempotency: true }).messages.getMessage({
      messageGuid: "spc-1",
    });
    expect(captured[0]?.headers.get("x-idempotency-key")).toBeNull();
  });

  it("wraps network failures as ConnectionError", async () => {
    globalThis.fetch = (() =>
      Promise.reject(new TypeError("fetch failed"))) as typeof fetch;
    await expect(
      clients().messages.getMessage({ messageGuid: "spc-1" })
    ).rejects.toBeInstanceOf(ConnectionError);
  });

  it("uploads raw bytes with fileName in the query", async () => {
    const captured: Captured[] = [];
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      captured.push({
        headers: request.headers,
        method: request.method,
        url: new URL(request.url),
        body: new Uint8Array(await request.arrayBuffer()),
      });
      return new Response(
        JSON.stringify({ attachment: { guid: "att-1", fileName: "a.txt" } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    const result = await clients().attachments.uploadAttachment({
      fileName: "a.txt",
      data: new Uint8Array([1, 2, 3]),
    });
    const call = captured[0];
    expect(call?.url.pathname).toBe("/v1/attachments:upload");
    expect(call?.url.searchParams.get("fileName")).toBe("a.txt");
    expect(call?.body).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.attachment?.guid).toBe("att-1");
  });

  it("rejects companion uploads with a clear error", async () => {
    await expect(
      clients().attachments.uploadAttachment({
        fileName: "a.heic",
        data: new Uint8Array([1]),
        companion: { data: new Uint8Array([2]), kind: 1 },
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("streams downloads as header + primary chunks", async () => {
    let call = 0;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      call += 1;
      if (call === 1) {
        expect(new URL(request.url).pathname).toBe("/v1/attachments/att-9");
        return new Response(
          JSON.stringify({
            attachment: { guid: "att-9", mimeType: "image/heic" },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      expect(new URL(request.url).pathname).toBe("/v1/attachments/att-9/data");
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
            controller.enqueue(new Uint8Array([3]));
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "image/heic" } }
      );
    }) as typeof fetch;

    const frames: unknown[] = [];
    for await (const frame of clients().attachments.downloadAttachment({
      attachmentGuid: "att-9",
    })) {
      frames.push(frame);
    }
    expect(frames.length).toBe(3);
    expect((frames[0] as { header?: unknown }).header).toBeTruthy();
    expect((frames[1] as { primaryChunk?: Uint8Array }).primaryChunk).toEqual(
      new Uint8Array([1, 2])
    );
    expect((frames[2] as { primaryChunk?: Uint8Array }).primaryChunk).toEqual(
      new Uint8Array([3])
    );
  });

  it("returns embedded media bytes with their mime type", async () => {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([9, 9]), {
        status: 200,
        headers: { "content-type": "image/png" },
      })) as typeof fetch;
    const response = await clients().messages.getEmbeddedMedia({
      chatGuid: "any;-;x",
      messageGuid: "spc-1",
    });
    expect(response.media?.mimeType).toBe("image/png");
    expect(response.media?.data).toEqual(new Uint8Array([9, 9]));
  });

  it("respects tls=false and full URLs for the base address", async () => {
    const captured = mockFetch([{ status: 200, body: { message: {} } }]);
    await clients({
      tls: false,
      address: "localhost:8080",
    }).messages.getMessage({ messageGuid: "spc-1" });
    expect(captured[0]?.url.origin).toBe("http://localhost:8080");
  });
});
