/**
 * Unit tests for the withRetry utility function.
 */

import { describe, expect, it } from "bun:test";
import { IMessageError } from "../../src/errors/imessage-error.ts";
import { withRetry } from "../../src/utils/retry.ts";

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries retryable IMessageError up to maxAttempts", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new IMessageError("transient", {
            code: "serviceUnavailable" as any,
            retryable: true,
            grpcCode: 14,
          });
        }
        return "recovered";
      },
      { maxAttempts: 4, initialDelay: 1, maxDelay: 1 },
    );

    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("does not retry non-retryable IMessageError", async () => {
    let calls = 0;
    try {
      await withRetry(
        async () => {
          calls++;
          throw new IMessageError("permanent", {
            code: "chatNotFound" as any,
            retryable: false,
            grpcCode: 5,
          });
        },
        { maxAttempts: 3, initialDelay: 1, maxDelay: 1 },
      );
      throw new Error("should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(IMessageError);
      expect(err.message).toBe("permanent");
    }
    expect(calls).toBe(1);
  });

  it("does not retry non-IMessageError errors", async () => {
    let calls = 0;
    try {
      await withRetry(
        async () => {
          calls++;
          throw new Error("generic");
        },
        { maxAttempts: 3, initialDelay: 1, maxDelay: 1 },
      );
      throw new Error("should have thrown");
    } catch (err: any) {
      expect(err.message).toBe("generic");
    }
    expect(calls).toBe(1);
  });

  it("throws after exhausting all attempts", async () => {
    let calls = 0;
    try {
      await withRetry(
        async () => {
          calls++;
          throw new IMessageError(`fail ${calls}`, {
            code: "serviceUnavailable" as any,
            retryable: true,
            grpcCode: 14,
          });
        },
        { maxAttempts: 2, initialDelay: 1, maxDelay: 1 },
      );
      throw new Error("should have thrown");
    } catch (err: any) {
      expect(err.message).toBe("fail 2");
    }
    expect(calls).toBe(2);
  });

  it("aborts early when signal is aborted", async () => {
    const controller = new AbortController();
    let calls = 0;

    // Abort after first failure
    try {
      await withRetry(
        async () => {
          calls++;
          controller.abort();
          throw new IMessageError("transient", {
            code: "serviceUnavailable" as any,
            retryable: true,
            grpcCode: 14,
          });
        },
        { maxAttempts: 5, initialDelay: 1, maxDelay: 1, signal: controller.signal },
      );
      throw new Error("should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(IMessageError);
    }
    expect(calls).toBe(1);
  });

  it("uses default options when none provided", async () => {
    // Just verify it doesn't throw with default options on a success case
    const result = await withRetry(async () => "ok");
    expect(result).toBe("ok");
  });
});
