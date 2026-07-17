import { describe, expect, it } from "bun:test";
import {
  IMessageError,
  ValidationError,
} from "../src/errors/imessage-error.ts";
import { toIMessageError } from "../src/errors/to-imessage-error.ts";

describe("toIMessageError (resource seam)", () => {
  it("passes IMessageError subclasses through untouched", () => {
    const original = new ValidationError("bad", {
      code: "invalidArgument",
      context: {},
      grpcCode: 3,
      retryable: false,
    });
    expect(toIMessageError(original)).toBe(original);
  });

  it("wraps unknown errors in the base class", () => {
    const error = toIMessageError(new Error("wat"));
    expect(error).toBeInstanceOf(IMessageError);
    expect(error.code).toBe("internalError");
    expect(error.message).toBe("wat");
    expect(error.retryable).toBe(false);
    expect(error.grpcCode).toBe(2);
  });

  it("stringifies non-Error throwables", () => {
    const error = toIMessageError("boom");
    expect(error).toBeInstanceOf(IMessageError);
    expect(error.message).toBe("boom");
    expect(error.cause).toBeUndefined();
  });

  it("preserves the original error as cause", () => {
    const original = new Error("root");
    expect(toIMessageError(original).cause).toBe(original);
  });
});
