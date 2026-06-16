import { describe, expect, it } from "bun:test";
import { FriendLocationType } from "../../src/generated/photon/imessage/v1/location_types_pb.js";
import { LocationsResource } from "../../src/resources/locations.ts";

describe("LocationsResource", () => {
  it("sends an empty request for list()", async () => {
    const requests: Record<string, unknown>[] = [];
    const resource = new LocationsResource({
      async listSharedFriendLocations(request: Record<string, unknown>) {
        requests.push(request);
        return { locations: [] };
      },
    } as any);

    await resource.list();

    expect(requests).toEqual([{}]);
  });

  it("scopes watch(string) to one address", async () => {
    const requests: Record<string, unknown>[] = [];
    const resource = new LocationsResource({
      async *watchSharedFriendLocations(request: Record<string, unknown>) {
        requests.push(request);
        yield* [];
      },
    } as any);

    const stream = resource.watch("friend-1@example.com");
    for await (const _update of stream) {
      break;
    }

    expect(requests).toEqual([{ address: "friend-1@example.com" }]);
  });

  it("sends an empty watch request when address is omitted", async () => {
    const requests: Record<string, unknown>[] = [];
    const resource = new LocationsResource({
      async *watchSharedFriendLocations(request: Record<string, unknown>) {
        requests.push(request);
        yield* [];
      },
    } as any);

    const stream = resource.watch();
    for await (const _update of stream) {
      break;
    }

    expect(requests).toEqual([{}]);
  });

  it("maps FRIEND_LOCATION_TYPE_LEGACY from the proto enum", async () => {
    const resource = new LocationsResource({
      async getSharedFriendLocation() {
        return {
          location: {
            address: "friend-legacy@example.com",
            isLocatingInProgress: false,
            locationType: FriendLocationType.LEGACY,
          },
        };
      },
    } as any);

    const friend = await resource.get("friend-legacy@example.com");

    expect(friend.locationType).toBe("legacy");
  });
});
