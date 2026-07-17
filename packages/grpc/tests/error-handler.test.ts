import { describe, expect, it } from "bun:test";
import { Metadata } from "@grpc/grpc-js";
import {
  ConnectionError,
  IMessageError,
  NotFoundError,
  ValidationError,
} from "@photon-ai/aim-core/internal";
import { ClientError, Status } from "nice-grpc-common";
import { fromGrpcError } from "../src/v1/errors/error-handler.ts";

function makeClientError(
  code: Status,
  details: string,
  metadataEntries: Record<string, string> = {}
): ClientError {
  const metadata = new Metadata();
  for (const [key, value] of Object.entries(metadataEntries)) {
    metadata.set(key, value);
  }
  const error = new ClientError(
    "/photon.imessage.v1.TestService/TestMethod",
    code,
    details
  ) as ClientError & {
    metadata?: Metadata;
  };
  error.metadata = metadata;
  return error;
}

describe("fromGrpcError", () => {
  it("maps NOT_FOUND to NotFoundError and preserves canonical error-code", () => {
    const error = fromGrpcError(
      makeClientError(Status.NOT_FOUND, "Attachment does not exist", {
        "error-code": "attachmentNotFound",
      })
    );

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe("attachmentNotFound");
    expect(error.message).toBe("Attachment does not exist");
  });

  it("maps INVALID_ARGUMENT to ValidationError", () => {
    const error = fromGrpcError(
      makeClientError(Status.INVALID_ARGUMENT, "chat_guid must be valid", {
        "error-code": "invalidArgument",
      })
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe("invalidArgument");
  });

  it("surfaces error-context-* metadata on error.context", () => {
    const error = fromGrpcError(
      makeClientError(Status.INVALID_ARGUMENT, "address must be valid", {
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

  it("maps DEADLINE_EXCEEDED to ConnectionError and surfaces retryability", () => {
    const error = fromGrpcError(
      makeClientError(Status.DEADLINE_EXCEEDED, "deadline exceeded", {
        "error-code": "timeout",
        "x-retryable": "true",
      })
    );

    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.code).toBe("timeout");
    expect(error.retryable).toBe(true);
  });

  it("wraps non-gRPC errors as base IMessageError with internalError", () => {
    const error = fromGrpcError(new Error("boom"));

    expect(error).toBeInstanceOf(IMessageError);
    expect(error.code).toBe("internalError");
    expect(error.message).toBe("boom");
  });
});
