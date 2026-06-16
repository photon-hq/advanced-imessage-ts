import { describe, expect, it } from "bun:test";
import { Code, ConnectError } from "@connectrpc/connect";
import { NotFoundError } from "../../src/errors/imessage-error.ts";
import { AddressesResource } from "../../src/resources/addresses.ts";

function makeConnectError(
  code: Code,
  details: string,
  metadataEntries: Record<string, string> = {}
): ConnectError {
  return new ConnectError(details, code, metadataEntries);
}

describe("AddressesResource", () => {
  it("rethrows addressNotFound", async () => {
    const resource = new AddressesResource({
      async getAddressInfo() {
        throw makeConnectError(Code.NotFound, "Address does not exist", {
          "error-code": "addressNotFound",
        });
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
        throw makeConnectError(Code.NotFound, "Chat does not exist", {
          "error-code": "chatNotFound",
        });
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
