/**
 * Client type aliases shared by every transport.
 *
 * The unary subset of the ts-proto client interfaces — streaming RPCs ride
 * Fusor/webhooks (or the legacy gRPC transport), not the HTTP transport.
 * Resource classes type their injected client against these.
 */

import type { AddressServiceClient as GenAddressServiceClient } from "./generated/photon/imessage/v1/address_service.ts";
import type { AttachmentServiceClient as GenAttachmentServiceClient } from "./generated/photon/imessage/v1/attachment_service.ts";
import type { ChatServiceClient as GenChatServiceClient } from "./generated/photon/imessage/v1/chat_service.ts";
import type { GroupServiceClient as GenGroupServiceClient } from "./generated/photon/imessage/v1/group_service.ts";
import type { LocationServiceClient as GenLocationServiceClient } from "./generated/photon/imessage/v1/location_service.ts";
import type { MessageServiceClient as GenMessageServiceClient } from "./generated/photon/imessage/v1/message_service.ts";
import type { PollServiceClient as GenPollServiceClient } from "./generated/photon/imessage/v1/poll_service.ts";

export type AddressServiceClient = GenAddressServiceClient;
export type AttachmentServiceClient = GenAttachmentServiceClient;
export type ChatServiceClient = Omit<
  GenChatServiceClient,
  "subscribeChatEvents"
>;
export type GroupServiceClient = Omit<
  GenGroupServiceClient,
  "subscribeGroupEvents"
>;
export type LocationServiceClient = Omit<
  GenLocationServiceClient,
  "watchSharedFriendLocations"
>;
export type MessageServiceClient = Omit<
  GenMessageServiceClient,
  "subscribeMessageEvents"
>;
export type PollServiceClient = Omit<
  GenPollServiceClient,
  "subscribePollEvents"
>;
