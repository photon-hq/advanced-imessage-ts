import { describe, expect, it } from "bun:test";
import { Code, ConnectError } from "@connectrpc/connect";
import { fromGrpcError } from "../../src/errors/error-handler.ts";
import {
  ConnectionError,
  IMessageError,
  NotFoundError,
  ValidationError,
} from "../../src/errors/imessage-error.ts";

function makeConnectError(
  code: Code,
  details: string,
  metadataEntries: Record<string, string> = {}
): ConnectError {
  return new ConnectError(details, code, metadataEntries);
}

describe("fromGrpcError", () => {
  it("maps NotFound to NotFoundError and preserves canonical error-code", () => {
    const error = fromGrpcError(
      makeConnectError(Code.NotFound, "Attachment does not exist", {
        "error-code": "attachmentNotFound",
      })
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe("attachmentNotFound");
    expect(error.message).toBe("Attachment does not exist");
  });

  it("maps InvalidArgument to ValidationError", () => {
    const error = fromGrpcError(
      makeConnectError(Code.InvalidArgument, "chat_guid must be valid", {
        "error-code": "invalidArgument",
      })
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe("invalidArgument");
  });

  it("surfaces error-context-* metadata on error.context", () => {
    const error = fromGrpcError(
      makeConnectError(Code.InvalidArgument, "address must be valid", {
        "error-code": "invalidArgument",
        "error-context-field": "address",
        "error-context-value": "foo@bar",
      })
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.context).toEqual({
      field: "address",
      value: "foo@bar",
    });
  });

  it("maps DeadlineExceeded to ConnectionError and surfaces retryability", () => {
    const error = fromGrpcError(
      makeConnectError(Code.DeadlineExceeded, "deadline exceeded", {
        "error-code": "timeout",
        "x-retryable": "true",
      })
    );

    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.code).toBe("timeout");
    expect(error.retryable).toBe(true);
  });

  it("wraps non-Connect errors as base IMessageError with internalError", () => {
    const error = fromGrpcError(new Error("boom"));

    expect(error).toBeInstanceOf(IMessageError);
    expect(error.code).toBe("internalError");
    expect(error.message).toBe("boom");
  });
});
