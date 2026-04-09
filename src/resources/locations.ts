/**
 * LocationsResource -- Find My Friends location operations.
 *
 * Wraps the gRPC LocationService to provide high-level methods for
 * retrieving friend locations and subscribing to location update events.
 */

import { fromGrpcError } from "../errors/error-handler.ts";
import type { FindMyEvent } from "../generated/photon/imessage/v1/location_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { LocationServiceClient } from "../transport/grpc-client.ts";
import { mapFindMyFriend } from "../transport/mapper.ts";
import type { LocationEvent } from "../types/events.ts";
import type { FindMyFriend } from "../types/locations.ts";

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export class LocationsResource {
  private readonly _client: LocationServiceClient;

  constructor(client: LocationServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Get the current cached Find My snapshot and trigger a server-side
   * background refresh.
   */
  async getFriends(friendIds?: readonly string[]): Promise<FindMyFriend[]> {
    try {
      const response = await this._client.getFriends({
        friendIds: friendIds ? [...friendIds] : [],
      });
      return response.friends.map(mapFindMyFriend);
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  /** Subscribe to real-time location update events. Returns a typed stream. */
  subscribe(): TypedEventStream<LocationEvent> {
    const rpcStream = this._client.subscribeLocationEvents({});

    async function* mapEvents(): AsyncGenerator<LocationEvent> {
      try {
        for await (const proto of rpcStream) {
          const timestamp = proto.timestamp ?? new Date();

          if (proto.findMyLocationUpdated === undefined) {
            continue;
          }

          const evt: FindMyEvent = proto.findMyLocationUpdated;

          yield {
            type: "location.updated" as const,
            friends: evt.friends.map(mapFindMyFriend),
            timestamp,
          };
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream<LocationEvent>(mapEvents());
  }
}
