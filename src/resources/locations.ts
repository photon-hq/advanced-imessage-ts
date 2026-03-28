/**
 * LocationsResource -- Find My Friends location operations.
 *
 * Wraps the gRPC LocationService to provide high-level methods for
 * retrieving friend locations and subscribing to location update events.
 */

import type { FindMyFriend } from "../types/locations.ts";
import type { LocationEvent } from "../types/events.ts";
import type { ILocationServiceClient } from "../transport/grpc-client.ts";
import { mapFindMyFriend, timestampToDate } from "../transport/mapper.ts";
import { fromGrpcError } from "../errors/error-handler.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { FindMyEvent } from "../generated/photon/imessage/v1/location_service.ts";

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export class LocationsResource {
  private readonly _client: ILocationServiceClient;

  constructor(client: ILocationServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /** Get the current list of Find My Friends with their last known locations. */
  async getFriends(): Promise<FindMyFriend[]> {
    try {
      const { response } = await this._client.getFriends({});
      return response.friends.map(mapFindMyFriend);
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Force a refresh of friend locations and return the updated list. */
  async refreshFriends(): Promise<FindMyFriend[]> {
    try {
      const { response } = await this._client.refreshFriends({});
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
    const rpcCall = this._client.subscribeLocationEvents({});

    async function* mapEvents(): AsyncGenerator<LocationEvent> {
      try {
        for await (const proto of rpcCall.responses) {
          const timestamp = proto.timestamp
            ? timestampToDate(proto.timestamp)
            : new Date();

          if (proto.payload.oneofKind !== "findMyLocationUpdated") continue;

          const evt = (proto.payload as any).findMyLocationUpdated as FindMyEvent;

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
