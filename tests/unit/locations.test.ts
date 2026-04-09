import { describe, expect, it } from "bun:test";
import { FindMyLocationType } from "../../src/generated/photon/imessage/v1/location_service.ts";
import { LocationsResource } from "../../src/resources/locations.ts";

describe("LocationsResource", () => {
  it("passes friendIds through getFriends requests", async () => {
    const requests: Array<{ friendIds: string[] }> = [];
    const resource = new LocationsResource({
      async *subscribeLocationEvents() {
        yield* [];
      },
      async getFriends(request: { friendIds?: string[] }) {
        requests.push({ friendIds: request.friendIds ?? [] });
        return { friends: [] };
      },
    } as any);

    await resource.getFriends(["friend-1", "friend-2"]);

    expect(requests).toEqual([
      {
        friendIds: ["friend-1", "friend-2"],
      },
    ]);
  });

  it("does not expose the removed refreshFriends API", () => {
    const resource = new LocationsResource({
      async *subscribeLocationEvents() {
        yield* [];
      },
      async getFriends() {
        return { friends: [] };
      },
    } as any);

    expect("refreshFriends" in resource).toBe(false);
  });

  it("maps legacy location types from the proto enum", async () => {
    const resource = new LocationsResource({
      async *subscribeLocationEvents() {
        yield* [];
      },
      async getFriends() {
        return {
          friends: [
            {
              id: "friend-legacy",
              isLocatingInProgress: false,
              locationType: FindMyLocationType.FIND_MY_LOCATION_TYPE_LEGACY,
            },
          ],
        };
      },
    } as any);

    const [friend] = await resource.getFriends();

    expect(friend?.locationType).toBe("legacy");
  });
});
