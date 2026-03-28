/**
 * LocationsResource -- Find My Friends location operations.
 *
 * Wraps the gRPC LocationService to provide high-level methods for
 * retrieving friend locations and subscribing to location update events.
 */

import type { FindMyFriend } from "../types/locations.ts";
import type { LocationEvent } from "../types/events.ts";
import type { LocationServiceClient } from "../transport/grpc-client.ts";
import { mapFindMyFriend } from "../transport/mapper.ts";
import { fromGrpcError } from "../errors/error-handler.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { FindMyEvent } from "../generated/photon/imessage/v1/location_service.ts";

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

  /** Get the current list of Find My Friends with their last known locations. */
  async getFriends(): Promise<FindMyFriend[]> {
    try {
      const response = await this._client.getFriends({});
      return response.friends.map(mapFindMyFriend);
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Force a refresh of friend locations and return the updated list. */
  async refreshFriends(): Promise<FindMyFriend[]> {
    try {
      const response = await this._client.refreshFriends({});
      return response.friends.map(mapFindMyFriend);
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  /** Subscribe to location update events. Returns a typed event stream. */
  subscribe(): TypedEventStream<LocationEvent> {
    const rpcStream = this._client.subscribeLocationEvents({});

    async function* mapEvents(): AsyncGenerator<LocationEvent> {
      try {
        for await (const proto of rpcStream) {
          const timestamp = proto.timestamp ?? new Date();

          if (proto.findMyLocationUpdated === undefined) continue;

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
