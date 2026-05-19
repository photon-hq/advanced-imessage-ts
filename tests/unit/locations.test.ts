import { describe, expect, it } from "bun:test";
import { ValidationError } from "../../src/errors/imessage-error.ts";
import { FriendLocationType } from "../../src/generated/photon/imessage/v1/location_types.ts";
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
            locationType: FriendLocationType.FRIEND_LOCATION_TYPE_LEGACY,
          },
        };
      },
    } as any);

    const friend = await resource.get("friend-legacy@example.com");

    expect(friend.locationType).toBe("legacy");
  });

  it("sends a requestLocationSharing request with chat and address", async () => {
    const requests: Record<string, unknown>[] = [];
    const resource = new LocationsResource({
      async requestLocationSharing(request: Record<string, unknown>) {
        requests.push(request);
        return {
          address: "+14155550123",
          requested: true,
          requestStatus: "sent",
          reason: "Find My request card dispatched to Messages",
          messageGuid: "message-guid",
        };
      },
    } as any);

    const receipt = await resource.request(
      "any;-;+14155550123",
      "+14155550123",
      {
        clientMessageId: "location-request-1",
      }
    );

    expect(requests).toEqual([
      {
        address: "+14155550123",
        chatGuid: "any;-;+14155550123",
        clientMessageId: "location-request-1",
      },
    ]);
    expect(receipt).toEqual({
      address: "+14155550123",
      requested: true,
      requestStatus: "sent",
      reason: "Find My request card dispatched to Messages",
      messageGuid: "message-guid",
    });
  });

  it("rejects malformed chat guids before requesting location sharing", async () => {
    let called = false;
    const resource = new LocationsResource({
      async requestLocationSharing() {
        called = true;
        return {};
      },
    } as any);

    await expect(
      resource.request("not-a-chat-guid", "+14155550123")
    ).rejects.toBeInstanceOf(ValidationError);
    expect(called).toBe(false);
  });
});
