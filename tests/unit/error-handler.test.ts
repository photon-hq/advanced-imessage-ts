import { describe, expect, it } from "bun:test";
import { fromGrpcError } from "../../src/errors/error-handler.ts";
import {
  fromHttpErrorBody,
  fromTransportFailure,
} from "../../src/errors/http-error-handler.ts";
import {
  AuthenticationError,
  ConnectionError,
  IMessageError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "../../src/errors/imessage-error.ts";

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

  it("falls back to the HTTP status when the body is not from the middleware", () => {
    const error = fromHttpErrorBody({}, 503);
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.grpcCode).toBe(14);
    expect(error.code).toBe("internalError");
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

describe("fromGrpcError (resource seam)", () => {
  it("passes IMessageError through untouched", () => {
    const original = fromHttpErrorBody(
      { code: "invalid_argument", message: "bad" },
      400
    );
    expect(fromGrpcError(original)).toBe(original);
  });

  it("wraps unknown errors in the base class", () => {
    const error = fromGrpcError(new Error("wat"));
    expect(error).toBeInstanceOf(IMessageError);
    expect(error.code).toBe("internalError");
    expect(error.message).toBe("wat");
  });
});
