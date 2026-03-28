/**
 * AddressesResource -- resolves address metadata, checks Focus Mode status,
 * and verifies iMessage availability for phone numbers and email addresses.
 */

import type { IAddressServiceClient } from "../transport/grpc-client.ts";
import { mapAddressInfo } from "../transport/mapper.ts";
import { fromGrpcError } from "../errors/error-handler.ts";

import type { AddressInfo } from "../types/addresses.ts";

import { AvailabilityType } from "../generated/photon/imessage/v1/address_service.ts";

// ---------------------------------------------------------------------------
// AddressesResource
// ---------------------------------------------------------------------------

export class AddressesResource {
  private readonly _client: IAddressServiceClient;

  constructor(client: IAddressServiceClient) {
    this._client = client;
  }

  /**
   * Resolve metadata for an address (phone number or email).
   *
   * Returns the canonical form of the address along with service information
   * and country code.
   */
  async get(address: string): Promise<AddressInfo> {
    try {
      const { response } = await this._client.getAddress({ address });
      return mapAddressInfo(response.address!);
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Check whether an address currently has Focus Mode (Do Not Disturb)
   * enabled.
   *
   * @returns `true` if the address has a Focus mode active.
   */
  async getFocusStatus(address: string): Promise<boolean> {
    try {
      const { response } = await this._client.getFocusStatus({ address });
      return response.isFocused;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Check whether an address is available on iMessage.
   *
   * @param address - The phone number or email to check.
   * @param type    - The service type to check availability for.
   *                  Defaults to `"iMessage"`.
   * @returns `true` if the address is reachable on the specified service.
   */
  async checkAvailability(
    address: string,
    type?: "iMessage",
  ): Promise<boolean> {
    try {
      const { response } = await this._client.checkAvailability({
        address,
        type: type === "iMessage" || type === undefined
          ? AvailabilityType.IMESSAGE
          : AvailabilityType.UNSPECIFIED,
      });
      return response.available;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }
}
