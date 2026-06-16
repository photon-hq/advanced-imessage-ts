/**
 * Unit tests for the Connect client interceptors:
 * - authInterceptor
 * - idempotencyInterceptor
 * - retryInterceptor
 * - timeoutInterceptor
 *
 * These tests build a fake `(req, next)` chain that mirrors Connect's
 * interceptor contract without requiring an actual transport.
 */

import { describe, expect, it } from "bun:test";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  authInterceptor,
  idempotencyInterceptor,
  retryInterceptor,
  timeoutInterceptor,
} from "../../src/transport/metadata.ts";
import type { RetryOptions } from "../../src/types/common.ts";
import {
  readMetadataPrefixedEntries,
  readMetadataValue,
} from "../../src/utils/grpc-metadata.ts";

// ---------------------------------------------------------------------------
// Helpers — mock the Connect interceptor request/next interface
// ---------------------------------------------------------------------------

interface MockRequest {
  header: Headers;
  message: unknown;
  method: { name: string };
  service: { typeName: string };
  signal: AbortSignal;
  stream: boolean;
}

function makeReq(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    stream: false,
    header: new Headers(),
    signal: new AbortController().signal,
    service: { typeName: "test.Service" },
    method: { name: "Unary" },
    message: {},
    ...overrides,
  };
}

const passthrough = async (req: unknown) => ({ message: "ok", req });

/** Apply an interceptor with a fake `next`, returning the response. */
function run(
  interceptor: any,
  next: (req: any) => Promise<unknown>,
  req: MockRequest
): Promise<unknown> {
  return interceptor(next)(req);
}

const retryableError = (details: string) =>
  new ConnectError(details, Code.Unavailable, { "x-retryable": "true" });

// =========================================================================
// authInterceptor
// =========================================================================

describe("authInterceptor", () => {
  it("sets a Bearer authorization header from a static token", async () => {
    const req = makeReq();
    await run(authInterceptor("my-token"), passthrough, req);
    expect(req.header.get("authorization")).toBe("Bearer my-token");
  });

  it("resolves an async token on each call", async () => {
    const req = makeReq();
    await run(
      authInterceptor(() => Promise.resolve("fresh-token")),
      passthrough,
      req
    );
    expect(req.header.get("authorization")).toBe("Bearer fresh-token");
  });
});

// =========================================================================
// idempotencyInterceptor
// =========================================================================

describe("idempotencyInterceptor", () => {
  it("adds x-idempotency-key to mutating RPCs from the server contract", async () => {
    const req = makeReq({
      service: { typeName: "photon.imessage.v1.MessageService" },
      method: { name: "SendTextMessage" },
    });
    await run(idempotencyInterceptor(), passthrough, req);
    expect(req.header.get("x-idempotency-key")).toHaveLength(36);
  });

  it("does not add x-idempotency-key to catch-up streams", async () => {
    const req = makeReq({
      stream: true,
      service: { typeName: "photon.imessage.v1.EventService" },
      method: { name: "CatchUpEvents" },
    });
    await run(idempotencyInterceptor(), passthrough, req);
    expect(req.header.get("x-idempotency-key")).toBeNull();
  });

  it("does not add x-idempotency-key to read RPCs", async () => {
    const req = makeReq({
      service: { typeName: "photon.imessage.v1.MessageService" },
      method: { name: "GetMessage" },
    });
    await run(idempotencyInterceptor(), passthrough, req);
    expect(req.header.get("x-idempotency-key")).toBeNull();
  });
});

// =========================================================================
// retryInterceptor
// =========================================================================

describe("retryInterceptor", () => {
  it("retries on x-retryable errors up to maxAttempts", async () => {
    const opts: RetryOptions = { maxAttempts: 3, initialDelay: 1, maxDelay: 1 };
    let attempts = 0;
    const next = async () => {
      attempts++;
      if (attempts < 3) {
        throw retryableError("unavailable");
      }
      return { message: "success" };
    };

    const result = (await run(retryInterceptor(opts), next, makeReq())) as {
      message: string;
    };

    expect(result.message).toBe("success");
    expect(attempts).toBe(3);
  });

  it("does not retry non-retryable errors", async () => {
    const opts: RetryOptions = { maxAttempts: 3, initialDelay: 1, maxDelay: 1 };
    let attempts = 0;
    const next = async () => {
      attempts++;
      throw new ConnectError("not found", Code.NotFound);
    };

    await expect(run(retryInterceptor(opts), next, makeReq())).rejects.toThrow(
      "not found"
    );
    expect(attempts).toBe(1);
  });

  it("throws after exhausting all attempts", async () => {
    const opts: RetryOptions = { maxAttempts: 2, initialDelay: 1, maxDelay: 1 };
    let attempts = 0;
    const next = async () => {
      attempts++;
      throw retryableError(`fail ${attempts}`);
    };

    await expect(run(retryInterceptor(opts), next, makeReq())).rejects.toThrow(
      "fail 2"
    );
    expect(attempts).toBe(2);
  });

  it("skips retry for streaming calls", async () => {
    const opts: RetryOptions = { maxAttempts: 3, initialDelay: 1, maxDelay: 1 };
    let attempts = 0;
    const next = async () => {
      attempts++;
      throw retryableError("unavailable");
    };

    await expect(
      run(retryInterceptor(opts), next, makeReq({ stream: true }))
    ).rejects.toThrow("unavailable");
    expect(attempts).toBe(1);
  });

  it("uses default options when none provided", () => {
    expect(retryInterceptor()).toBeFunction();
  });
});

// =========================================================================
// timeoutInterceptor
// =========================================================================

describe("timeoutInterceptor", () => {
  it("combines the caller's signal with a timeout on unary calls", async () => {
    let receivedSignal: AbortSignal | undefined;
    const next = async (req: MockRequest) => {
      receivedSignal = req.signal;
      return { message: "ok" };
    };

    const caller = new AbortController();
    const req = makeReq({ signal: caller.signal });
    await run(timeoutInterceptor(5000), next as never, req);

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).not.toBe(caller.signal);
    expect(receivedSignal?.aborted).toBe(false);

    caller.abort();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("skips streaming calls", async () => {
    let receivedSignal: AbortSignal | undefined;
    const next = async (req: MockRequest) => {
      receivedSignal = req.signal;
      return { message: "ok" };
    };

    const req = makeReq({ stream: true });
    await run(timeoutInterceptor(5000), next as never, req);

    // Streaming calls are passed through untouched.
    expect(receivedSignal).toBe(req.signal);
  });
});

// =========================================================================
// metadata helpers (Headers-based)
// =========================================================================

describe("metadata helpers", () => {
  it("reads a single header value", () => {
    const headers = new Headers({
      "error-code": "chatNotFound",
      "x-retryable": "true",
    });
    expect(readMetadataValue(headers, "error-code")).toBe("chatNotFound");
    expect(readMetadataValue(headers, "x-retryable")).toBe("true");
    expect(readMetadataValue(headers, "nonexistent")).toBeUndefined();
  });

  it("reads prefixed entries for error-context parsing", () => {
    const headers = new Headers({
      "error-code": "invalidArgument",
      "error-context-field": "address",
      "error-context-value": "foo@bar",
    });
    expect(readMetadataPrefixedEntries(headers, "error-context-")).toEqual({
      field: "address",
      value: "foo@bar",
    });
  });
});
