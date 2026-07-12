import { describe, expect, it } from "bun:test";
import {
  AuthenticationError,
  ConnectionError,
  IMessageError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@photon-ai/aim-core/internal";
import {
  fromHttpErrorBody,
  fromTransportFailure,
} from "../src/http-error-handler.ts";

describe("fromHttpErrorBody", () => {
  it("maps middleware bodies to the same subclasses as gRPC statuses", () => {
    const cases: [string, number, unknown][] = [
      ["unauthenticated", 401, AuthenticationError],
      ["permission_denied", 403, AuthenticationError],
      ["not_found", 404, NotFoundError],
      ["resource_exhausted", 429, RateLimitError],
      ["invalid_argument", 400, ValidationError],
      ["failed_precondition", 400, ValidationError],
      ["unavailable", 503, ConnectionError],
      ["deadline_exceeded", 504, ConnectionError],
      ["internal", 500, IMessageError],
    ];
    for (const [code, status, cls] of cases) {
      const error = fromHttpErrorBody({ code, message: "boom" }, status);
      expect(error).toBeInstanceOf(cls as never);
      expect(error.message).toBe("boom");
    }
  });

  it("populates grpcCode from the body code, not the HTTP status", () => {
    // failed_precondition and invalid_argument share HTTP 400 — the body
    // code must win.
    const error = fromHttpErrorBody(
      { code: "failed_precondition", message: "nope" },
      400
    );
    expect(error.grpcCode).toBe(9);
  });

  it("carries errorCode, retryable, and context through", () => {
    const error = fromHttpErrorBody(
      {
        code: "not_found",
        message: "Message does not exist",
        errorCode: "messageNotFound",
        retryable: false,
        context: { chatGuid: "spc-1" },
      },
      404
    );
    expect(error.code).toBe("messageNotFound");
    expect(error.retryable).toBe(false);
    expect(error.context).toEqual({ chatGuid: "spc-1" });
  });

  it("carries the body's source onto the error", () => {
    const error = fromHttpErrorBody(
      { code: "unavailable", message: "down", source: "upstream" },
      503
    );
    expect(error.source).toBe("upstream");
  });

  it("classifies body-less statuses conservatively", () => {
    // [status, class, retryable, errorCode]
    const cases: [number, unknown, boolean, string][] = [
      [408, ConnectionError, true, "timeout"],
      [429, RateLimitError, true, "internalError"],
      [500, IMessageError, false, "internalError"],
      [502, ConnectionError, true, "serviceUnavailable"],
      [503, ConnectionError, true, "serviceUnavailable"],
      [504, ConnectionError, true, "timeout"],
      [400, ValidationError, false, "internalError"],
      [404, NotFoundError, false, "internalError"],
    ];
    for (const [status, cls, retryable, code] of cases) {
      const error = fromHttpErrorBody({}, status);
      expect(error).toBeInstanceOf(cls as never);
      expect(error.retryable).toBe(retryable);
      expect(error.code).toBe(code as never);
      expect(error.source).toBe("intermediary");
    }
  });

  it("keeps a body-less 500 as the non-retryable base class", () => {
    const error = fromHttpErrorBody({}, 500);
    expect(error.constructor).toBe(IMessageError);
    expect(error.retryable).toBe(false);
    expect(error.grpcCode).toBe(13);
  });

  it("tags body-less errors as middleware when the marker header is present", () => {
    const headers = new Headers({ "x-spectrum-middleware": "0.1.0" });
    const error = fromHttpErrorBody({}, 503, headers);
    expect(error.source).toBe("middleware");
  });

  it("parses Retry-After seconds into milliseconds", () => {
    const headers = new Headers({ "retry-after": "2" });
    const error = fromHttpErrorBody({}, 429, headers);
    expect(error.retryAfter).toBe(2000);
    expect(error).toBeInstanceOf(RateLimitError);
  });

  it("parses an HTTP-date Retry-After into a forward delay", () => {
    const headers = new Headers({
      "retry-after": new Date(Date.now() + 5000).toUTCString(),
    });
    const error = fromHttpErrorBody({}, 503, headers);
    expect(error.retryAfter).toBeGreaterThan(0);
    expect(error.retryAfter).toBeLessThanOrEqual(5000);
  });

  it("ignores an unparseable Retry-After", () => {
    const headers = new Headers({ "retry-after": "soonish" });
    const error = fromHttpErrorBody({}, 503, headers);
    expect(error.retryAfter).toBeUndefined();
  });

  it("attaches Retry-After to contract errors too", () => {
    const headers = new Headers({ "retry-after": "1" });
    const error = fromHttpErrorBody(
      { code: "resource_exhausted", message: "slow down", retryable: true },
      429,
      headers
    );
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(1000);
    expect(error.retryable).toBe(true);
  });
});

describe("fromTransportFailure", () => {
  it("passes an existing IMessageError through untouched", () => {
    const original = fromHttpErrorBody(
      { code: "not_found", message: "x" },
      404
    );
    expect(fromTransportFailure(original)).toBe(original);
  });

  it("wraps fetch failures as ConnectionError with networkError code", () => {
    const error = fromTransportFailure(new TypeError("fetch failed"));
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.code).toBe("networkError");
    expect(error.grpcCode).toBe(14);
  });

  it("maps AbortSignal.timeout aborts to the timeout code", () => {
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";
    const error = fromTransportFailure(timeoutError);
    expect(error.code).toBe("timeout");
    expect(error.grpcCode).toBe(4);
  });
});
