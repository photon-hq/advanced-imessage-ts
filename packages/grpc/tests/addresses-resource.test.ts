import { describe, expect, it } from "bun:test";
import { Metadata } from "@grpc/grpc-js";
import { NotFoundError } from "@photon-ai/aim-core/internal";
import { ClientError, Status } from "nice-grpc-common";
import { AddressesResource } from "../src/v1/resources/addresses.ts";

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
    "/photon.imessage.v1.AddressService/GetAddressInfo",
    code,
    details
  ) as ClientError & {
    metadata?: Metadata;
  };
  error.metadata = metadata;
  return error;
}

describe("AddressesResource", () => {
  it("rethrows addressNotFound", async () => {
    const resource = new AddressesResource({
      async getAddressInfo() {
        throw makeClientError(Status.NOT_FOUND, "Address does not exist", {
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
        throw makeClientError(Status.NOT_FOUND, "Chat does not exist", {
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
