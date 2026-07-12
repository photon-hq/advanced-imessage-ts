import { afterEach, describe, expect, it } from "bun:test";
import {
  ConnectionError,
  IMessageError,
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

  it("retries body-less 5xx responses from intermediaries", async () => {
    // No contract body — an LB answered. 503 defaults to retryable now.
    const captured = mockFetch([
      { status: 503, body: {} },
      { status: 200, body: { message: { guid: "m-3" } } },
    ]);
    const response = await clients({
      retry: { initialDelay: 1, maxDelay: 2 },
    }).messages.sendTextMessage({ chatGuid: "x", text: "y" });
    expect(captured.length).toBe(2);
    expect(response.message?.guid).toBe("m-3");
  });

  it("does not retry a body-less 500 and tags it intermediary", async () => {
    const captured = mockFetch([{ status: 500, body: {} }]);
    let caught: unknown;
    try {
      await clients({ retry: true }).messages.sendTextMessage({
        chatGuid: "x",
        text: "y",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(IMessageError);
    expect((caught as IMessageError).retryable).toBe(false);
    expect((caught as IMessageError).source).toBe("intermediary");
    expect(captured.length).toBe(1);
  });

  it("honors Retry-After over the client backoff", async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call += 1;
      if (call === 1) {
        return new Response("{}", {
          status: 503,
          headers: {
            "content-type": "application/json",
            "retry-after": "1",
          },
        });
      }
      return new Response(JSON.stringify({ message: { guid: "m-4" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const started = Date.now();
    // Client backoff would sleep at most ~2ms; Retry-After demands 1000ms.
    const response = await clients({
      retry: { initialDelay: 1, maxDelay: 2 },
    }).messages.sendTextMessage({ chatGuid: "x", text: "y" });
    expect(call).toBe(2);
    expect(response.message?.guid).toBe("m-4");
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  it("retries raw-route failures that arrive before the body streams", async () => {
    let dataCalls = 0;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      const path = new URL(request.url).pathname;
      if (path === "/v1/attachments/att-r") {
        return new Response(JSON.stringify({ attachment: { guid: "att-r" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      dataCalls += 1;
      if (dataCalls === 1) {
        // Plain-text 502 — an intermediary, no contract body.
        return new Response("bad gateway", {
          status: 502,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response(new Uint8Array([5]), { status: 200 });
    }) as typeof fetch;

    const frames: unknown[] = [];
    for await (const frame of clients({
      retry: { initialDelay: 1, maxDelay: 2 },
    }).attachments.downloadAttachment({ attachmentGuid: "att-r" })) {
      frames.push(frame);
    }
    expect(dataCalls).toBe(2);
    expect(frames.length).toBe(2); // header + the one chunk
  });

  it("reuses one idempotency key across raw upload retries", async () => {
    const keys: (string | null)[] = [];
    let call = 0;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      keys.push(request.headers.get("x-idempotency-key"));
      call += 1;
      if (call === 1) {
        return new Response("busy", {
          status: 503,
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response(JSON.stringify({ attachment: { guid: "att-1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    await clients({
      autoIdempotency: true,
      retry: { initialDelay: 1, maxDelay: 2 },
    }).attachments.uploadAttachment({
      fileName: "a.txt",
      data: new Uint8Array([1]),
    });
    expect(keys.length).toBe(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0] ?? "");
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

  it("uploads a companion as multipart/form-data", async () => {
    const captured: Array<{
      contentType: string | null;
      form: FormData;
      url: URL;
    }> = [];
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      captured.push({
        contentType: request.headers.get("content-type"),
        form: await request.formData(),
        url: new URL(request.url),
      });
      return new Response(
        JSON.stringify({
          attachment: { guid: "att-2", fileName: "a.heic" },
          companion: {
            fileName: "a.mov",
            kind: "COMPANION_KIND_LIVE_PHOTO_VIDEO",
            mimeType: "video/quicktime",
            totalBytes: 2,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    const result = await clients().attachments.uploadAttachment({
      fileName: "a.heic",
      data: new Uint8Array([1]),
      companion: { data: new Uint8Array([2, 2]), kind: 1 },
    });
    const call = captured[0];
    expect(call?.url.pathname).toBe("/v1/attachments:upload");
    expect(call?.url.searchParams.get("fileName")).toBe("a.heic");
    // fetch must own the multipart boundary — the SDK never sets the
    // content-type itself.
    expect(call?.contentType).toStartWith("multipart/form-data; boundary=");
    const file = call?.form.get("file");
    const companion = call?.form.get("companion");
    expect(new Uint8Array(await (file as Blob).arrayBuffer())).toEqual(
      new Uint8Array([1])
    );
    expect(new Uint8Array(await (companion as Blob).arrayBuffer())).toEqual(
      new Uint8Array([2, 2])
    );
    expect(call?.form.get("companionKind")).toBe("1");
    expect(result.companion?.kind).toBe(1);
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

  it("streams companion chunks after the primary payload", async () => {
    let call = 0;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      call += 1;
      if (call === 1) {
        expect(new URL(request.url).pathname).toBe("/v1/attachments/att-live");
        return new Response(
          JSON.stringify({
            attachment: {
              companionKind: "COMPANION_KIND_LIVE_PHOTO_VIDEO",
              guid: "att-live",
              mimeType: "image/heic",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (call === 2) {
        // The companion route opens before the header frame is emitted so
        // its headers can populate the frame's CompanionInfo.
        expect(new URL(request.url).pathname).toBe(
          "/v1/attachments/att-live/companion"
        );
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([7, 7]));
              controller.close();
            },
          }),
          {
            status: 200,
            headers: {
              "content-disposition": 'attachment; filename="cat.mov"',
              "content-type": "video/quicktime",
              "x-companion-kind": "1",
              "x-companion-total-bytes": "2",
            },
          }
        );
      }
      expect(new URL(request.url).pathname).toBe(
        "/v1/attachments/att-live/data"
      );
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "image/heic" } }
      );
    }) as typeof fetch;

    const frames: unknown[] = [];
    for await (const frame of clients().attachments.downloadAttachment({
      attachmentGuid: "att-live",
    })) {
      frames.push(frame);
    }
    expect(call).toBe(3);
    expect(frames.length).toBe(3);
    const header = (
      frames[0] as {
        header?: { companion?: Record<string, unknown> };
      }
    ).header;
    expect(header?.companion).toEqual({
      fileName: "cat.mov",
      kind: 1,
      mimeType: "video/quicktime",
      totalBytes: 2,
    });
    expect((frames[1] as { primaryChunk?: Uint8Array }).primaryChunk).toEqual(
      new Uint8Array([1, 2])
    );
    expect(
      (frames[2] as { companionChunk?: Uint8Array }).companionChunk
    ).toEqual(new Uint8Array([7, 7]));
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
