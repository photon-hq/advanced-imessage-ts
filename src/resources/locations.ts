import { fromGrpcError } from "../errors/error-handler.ts";
import type { LocationServiceClient } from "../transport/http-client.ts";
import {
  mapLocationRequestReceipt,
  mapSharedFriendLocation,
} from "../transport/mapper.ts";
import { normalizeChatGuid } from "../types/chat-guid.ts";
import type { IdempotencyOptions } from "../types/common.ts";
import type {
  LocationRequestReceipt,
  SharedFriendLocation,
} from "../types/locations.ts";
import { unwrap } from "../utils/unwrap.ts";

/**
 * Shared-location APIs.
 *
 * - `list()` returns every friend currently sharing a location with this
 *   account.
 * - `get(address)` fetches the latest shared-location snapshot for one friend.
 * - `request(chat, address)` sends a visible Find My request card in a chat.
 * - `watch(address?)` streams shared-location updates for all friends, or only
 *   one address when provided.
 */
export class LocationsResource {
  private readonly _client: LocationServiceClient;
  constructor(client: LocationServiceClient) {
    this._client = client;
  }

  /**
   * List every friend currently sharing a location with the local account.
   *
   * Returns an empty array when no active shared-location sessions exist.
   */
  async list(): Promise<SharedFriendLocation[]> {
    try {
      const response = await this._client.listSharedFriendLocations({});
      return response.locations.map(mapSharedFriendLocation);
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Fetch the latest shared-location snapshot for one address.
   *
   * Throws `NotFoundError` when that address is not currently sharing a
   * location with the local account.
   */
  async get(address: string): Promise<SharedFriendLocation> {
    try {
      const response = await this._client.getSharedFriendLocation({ address });
      return mapSharedFriendLocation(unwrap(response.location, "location"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Request location sharing from one participant in a chat.
   *
   * This sends a visible Find My request card. It does not grant access by
   * itself; the other person must accept or start sharing before `get`, `list`,
   * or `watch` can return their location.
   */
  async request(
    chat: string,
    address: string,
    options: IdempotencyOptions = {}
  ): Promise<LocationRequestReceipt> {
    try {
      const response = await this._client.requestFriendLocationSharing({
        address,
        chatGuid: normalizeChatGuid(chat),
        clientMessageId: options.clientMessageId,
      });
      return mapLocationRequestReceipt(response);
    } catch (err) {
      throw fromGrpcError(err);
    }
  }
}
