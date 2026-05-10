import { fromGrpcError } from "../errors/error-handler.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { LocationServiceClient } from "../transport/grpc-client.ts";
import {
  mapSharedFriendLocation,
  mapSharedFriendLocationUpdated,
} from "../transport/mapper.ts";
import type {
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
          if (!frame.locationUpdated) {
            continue;
          }
          yield mapSharedFriendLocationUpdated(frame.locationUpdated);
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream(mapUpdates(), async () => abort.abort());
  }
}
