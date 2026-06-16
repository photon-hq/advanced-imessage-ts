import { fromGrpcError } from "../errors/error-handler.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { LocationServiceClient } from "../transport/grpc-client.ts";
import {
  mapLocationRequestReceipt,
  mapSharedFriendLocation,
  mapSharedFriendLocationUpdated,
} from "../transport/mapper.ts";
import { normalizeChatGuid } from "../types/chat-guid.ts";
import type { IdempotencyOptions } from "../types/common.ts";
import type {
  LocationRequestReceipt,
  SharedFriendLocation,
  SharedFriendLocationUpdated,
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

  /** Watch updates for every shared friend, or one friend when `address` is set. */
  watch(address?: string): TypedEventStream<SharedFriendLocationUpdated> {
    const abort = new AbortController();
    const rpcStream = this._client.watchSharedFriendLocations(
      { address },
      { signal: abort.signal }
    );

    async function* mapUpdates(): AsyncGenerator<SharedFriendLocationUpdated> {
      try {
        for await (const frame of rpcStream) {
          if (frame.payload.case !== "locationUpdated") {
            continue;
          }
          yield mapSharedFriendLocationUpdated(frame.payload.value);
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream(mapUpdates(), async () => abort.abort());
  }
}
