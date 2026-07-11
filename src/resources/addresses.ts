import { fromGrpcError } from "../errors/error-handler.ts";
import type { AddressServiceClient } from "../transport/http-client.ts";
import { mapMultiServiceAddressInfo } from "../transport/mapper.ts";
import type { MultiServiceAddressInfo } from "../types/addresses.ts";
import { unwrap } from "../utils/unwrap.ts";

/**
 * Address APIs.
 *
 * - `get(address)` returns the server's known address record, country, and
 *   available transport services.
 * - `isFocusSilenced(address)` checks whether this device's Focus settings
 *   would silence notifications from the address.
 * - `isIMessageAvailable(address)` checks live iMessage reachability.
 */
export class AddressesResource {
  private readonly _client: AddressServiceClient;

  constructor(client: AddressServiceClient) {
    this._client = client;
  }

  /**
   * Look up the server's address record for a peer.
   *
   * Throws `NotFoundError` when the server has no record for the address.
   */
  async get(address: string): Promise<MultiServiceAddressInfo> {
    try {
      const response = await this._client.getAddressInfo({ address });
      return mapMultiServiceAddressInfo(unwrap(response.info, "info"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Whether this device's current Focus configuration would silence
   * notifications from the given address.
   *
   * @example
   * ```ts
   * const silenced = await im.addresses.isFocusSilenced("alice@example.com");
   * ```
   */
  async isFocusSilenced(address: string): Promise<boolean> {
    try {
      const response = await this._client.getFocusStatus({ address });
      return response.isSilencedByFocus;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Whether Apple currently reports the address as reachable on iMessage.
   *
   * @example
   * ```ts
   * const available = await im.addresses.isIMessageAvailable(
   *   "alice@example.com"
   * );
   * ```
   */
  async isIMessageAvailable(address: string): Promise<boolean> {
    try {
      const response = await this._client.getIMessageAvailability({ address });
      return response.isAvailable;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }
}
