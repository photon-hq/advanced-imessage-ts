import { describe, expect, it } from "bun:test";
import { NotFoundError } from "@photon-ai/aim-core/internal";
import { fromHttpErrorBody } from "../src/http-error-handler.ts";
import { AddressesResource } from "../src/resources/addresses.ts";

/** Builds the error the HTTP transport would throw for a middleware body. */
function makeTransportError(
  code: string,
  httpStatus: number,
  details: string,
  errorCode?: string
) {
  return fromHttpErrorBody({ code, message: details, errorCode }, httpStatus);
}

describe("AddressesResource", () => {
  it("rethrows addressNotFound", async () => {
    const resource = new AddressesResource({
      async getAddressInfo() {
        throw makeTransportError(
          "not_found",
          404,
          "Address does not exist",
          "addressNotFound"
        );
      },
    } as any);

    try {
      await resource.get("missing@example.com");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).code).toBe("addressNotFound");
    }
  });

  it("rethrows unrelated NOT_FOUND errors", async () => {
    const resource = new AddressesResource({
      async getAddressInfo() {
        throw makeTransportError(
          "not_found",
          404,
          "Chat does not exist",
          "chatNotFound"
        );
      },
    } as any);

    try {
      await resource.get("missing@example.com");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).code).toBe("chatNotFound");
    }
  });

  it("isFocusSilenced forwards the address and returns the server boolean", async () => {
    let requestedAddress: string | undefined;

    const resource = new AddressesResource({
      async getFocusStatus(request: { address?: string }) {
        requestedAddress = request.address;
        return { isSilencedByFocus: true };
      },
    } as any);

    await expect(resource.isFocusSilenced("alice@example.com")).resolves.toBe(
      true
    );
    expect(requestedAddress).toBe("alice@example.com");
  });
});
