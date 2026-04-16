/**
 * Mapper functions that convert between generated protobuf types and SDK
 * public domain types.
 *
 * Every generated proto type is imported with a `Proto` prefix to clearly
 * distinguish it from the handwritten SDK type of the same name.
 *
 * ts-proto generates `Date | undefined` for proto Timestamp fields and
 * numeric enums with `FULL_PREFIX_NAME` naming, so the conversion helpers
 * reflect that.
 */

// ---------------------------------------------------------------------------
// Generated proto imports
// ---------------------------------------------------------------------------

import type { Chat as ProtoChat } from "../generated/photon/imessage/v1/chat_service.ts";
import { SortDirection as ProtoSortDirection } from "../generated/photon/imessage/v1/common.ts";
import {
  type FindMyFriend as ProtoFindMyFriend,
  FindMyLocationType as ProtoFindMyLocationType,
} from "../generated/photon/imessage/v1/location_service.ts";
import {
  type AddressInfo as ProtoAddressInfo,
  type AttachmentInfo as ProtoAttachmentInfo,
  type Message as ProtoMessage,
  MessageItemType as ProtoMessageItemType,
  TransferState as ProtoTransferState,
} from "../generated/photon/imessage/v1/message_service.ts";
import type {
  PollInfo as ProtoPollInfo,
  PollOption as ProtoPollOption,
  PollVote as ProtoPollVote,
} from "../generated/photon/imessage/v1/poll_service.ts";
// ---------------------------------------------------------------------------
// SDK type imports
// ---------------------------------------------------------------------------

import type { AddressInfo } from "../types/addresses.ts";
import type { AttachmentInfo } from "../types/attachments.ts";
import {
  attachmentGuid,
  chatGuid,
  messageGuid,
} from "../types/branded.ts";
import type { Chat } from "../types/chats.ts";
import type {
  ChatServiceType,
  MessageItemType,
  SortDirection,
  TransferState,
} from "../types/enums.ts";
import type { FindMyFriend } from "../types/locations.ts";
import type { Message } from "../types/messages.ts";
import type { PollInfo, PollOption, PollVote } from "../types/polls.ts";

// ---------------------------------------------------------------------------
// Timestamp conversion
// ---------------------------------------------------------------------------

/**
 * Convert a proto timestamp value to a JavaScript `Date`.
 *
 * With ts-proto, timestamp fields are already `Date | undefined`. This
 * function is kept as a pass-through for call sites that rely on the
 * non-undefined overload (e.g. `timestampToDate(proto.timestamp)`).
 */
export function timestampToDate(ts: Date): Date {
  return ts;
}

/**
 * Convert a JavaScript `Date` to the proto timestamp representation.
 *
 * With ts-proto, timestamp fields accept `Date` directly.
 */
export function dateToTimestamp(date: Date): Date {
  return date;
}

// ---------------------------------------------------------------------------
// Enum conversion: proto -> SDK
// ---------------------------------------------------------------------------

/**
 * Map a proto `TransferState` enum value to the SDK string literal.
 */
export function mapTransferState(proto: ProtoTransferState): TransferState {
  switch (proto) {
    case ProtoTransferState.TRANSFER_STATE_TRANSFERRING:
      return "transferring";
    case ProtoTransferState.TRANSFER_STATE_FAILED:
      return "failed";
    case ProtoTransferState.TRANSFER_STATE_FINISHED:
      return "finished";
    case ProtoTransferState.TRANSFER_STATE_PENDING:
      return "pending";
    default:
      return "pending";
  }
}

/**
 * Map a proto `MessageItemType` enum value to the SDK string literal.
 */
export function mapMessageItemType(
  proto: ProtoMessageItemType
): MessageItemType {
  switch (proto) {
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_NORMAL:
      return "normal";
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_GROUP_NAME_CHANGE:
      return "groupNameChange";
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_PARTICIPANT_CHANGE:
      return "participantChange";
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_LEFT_GROUP:
      return "leftGroup";
    default:
      return "normal";
  }
}

/**
 * Map a proto `FindMyLocationType` enum value to the SDK string literal.
 *
 * Older servers used `UNSPECIFIED` for legacy locations, so we treat the
 * fallback path as `"legacy"` instead of silently misclassifying it.
 */
function mapLocationType(
  proto: ProtoFindMyLocationType
): "legacy" | "live" | "shallow" {
  switch (proto) {
    case ProtoFindMyLocationType.FIND_MY_LOCATION_TYPE_LIVE:
      return "live";
    case ProtoFindMyLocationType.FIND_MY_LOCATION_TYPE_SHALLOW:
      return "shallow";
    case ProtoFindMyLocationType.FIND_MY_LOCATION_TYPE_LEGACY:
      return "legacy";
    default:
      return "legacy";
  }
}

/**
 * Map a proto service string to the SDK `ChatServiceType`.
 */
function mapChatServiceType(service: string): ChatServiceType {
  if (service === "SMS") {
    return "SMS";
  }
  return "iMessage";
}

// ---------------------------------------------------------------------------
// Enum conversion: SDK -> proto (for request building)
// ---------------------------------------------------------------------------

/**
 * Map an SDK `SortDirection` to the proto enum value.
 */
export function mapSortDirection(sdk: SortDirection): ProtoSortDirection {
  switch (sdk) {
    case "ascending":
      return ProtoSortDirection.SORT_DIRECTION_ASCENDING;
    case "descending":
      return ProtoSortDirection.SORT_DIRECTION_DESCENDING;
    default:
      return ProtoSortDirection.SORT_DIRECTION_UNSPECIFIED;
  }
}

// ---------------------------------------------------------------------------
// Domain type mappers: proto -> SDK
// ---------------------------------------------------------------------------

/**
 * Map a proto `AddressInfo` to the SDK `AddressInfo`.
 */
export function mapAddressInfo(proto: ProtoAddressInfo): AddressInfo {
  return {
    address: proto.address,
    uncanonicalizedId: proto.uncanonicalizedId,
    service: mapChatServiceType(proto.service),
    country: proto.country,
    _raw: proto,
  };
}

/**
 * Map a proto `AttachmentInfo` to the SDK `AttachmentInfo`.
 */
export function mapAttachmentInfo(proto: ProtoAttachmentInfo): AttachmentInfo {
  return {
    guid: attachmentGuid(proto.guid),
    originalGuid: proto.originalGuid
      ? attachmentGuid(proto.originalGuid)
      : undefined,
    fileName: proto.fileName,
    mimeType: proto.mimeType,
    uti: proto.uti,
    totalBytes: proto.totalBytes,
    transferState: mapTransferState(proto.transferState),
    isOutgoing: proto.isOutgoing,
    hideAttachment: proto.hideAttachment,
    isSticker: proto.isSticker,
    width: proto.width,
    height: proto.height,
    hasLivePhoto: proto.hasLivePhoto,
    _raw: proto,
  };
}

/**
 * Map a proto `Message` to the SDK `Message`.
 *
 * ts-proto generates `Date | undefined` for all Timestamp fields, so we
 * pass them through directly instead of converting from a proto Timestamp
 * object.
 */
export function mapMessage(proto: ProtoMessage): Message {
  return {
    guid: messageGuid(proto.guid),
    clientMessageId: proto.clientMessageId,

    // Content
    text: proto.text,
    subject: proto.subject,

    // Timeline -- ts-proto gives us Date | undefined directly
    dateCreated: proto.dateCreated ?? new Date(0),
    dateRead: proto.dateRead,
    dateDelivered: proto.dateDelivered,
    dateEdited: proto.dateEdited,
    dateRetracted: proto.dateRetracted,
    datePlayed: proto.datePlayed,

    // Sender
    sender: proto.sender ? mapAddressInfo(proto.sender) : undefined,
    isFromMe: proto.isFromMe,

    // Delivery status
    isSent: proto.isSent,
    isDelivered: proto.isDelivered,
    isDeliveredQuietly: proto.isDeliveredQuietly,
    didNotifyRecipient: proto.didNotifyRecipient,
    sendErrorCode: proto.sendErrorCode,

    // Flags
    isAudioMessage: proto.isAudioMessage,
    isSystemMessage: proto.isSystemMessage,

    // Type / association
    itemType: mapMessageItemType(proto.itemType),
    associatedMessageGuid: proto.associatedMessageGuid
      ? messageGuid(proto.associatedMessageGuid)
      : undefined,
    associatedMessageEmoji: proto.associatedMessageEmoji,
    replyToGuid: proto.replyToGuid ? messageGuid(proto.replyToGuid) : undefined,

    // Rich content
    expressiveSendStyleId: proto.expressiveSendStyleId,

    // Relations
    attachments: proto.attachments.map(mapAttachmentInfo),
    chatGuids: proto.chatGuids.map(chatGuid),

    // Runtime
    latencyMs: proto.latencyMs,

    // Escape hatch
    _raw: proto,
  };
}

/**
 * Map a proto `Chat` to the SDK `Chat`.
 */
export function mapChat(proto: ProtoChat): Chat {
  return {
    guid: chatGuid(proto.guid),
    chatIdentifier: proto.chatIdentifier,
    groupId: proto.groupId,
    displayName: proto.displayName,
    isGroup: proto.isGroup,
    service: mapChatServiceType(proto.service),
    isArchived: proto.isArchived,
    isFiltered: proto.isFiltered,
    unreadCount: proto.unreadCount,
    participants: proto.participants.map(mapAddressInfo),
    lastMessage: proto.lastMessage ? mapMessage(proto.lastMessage) : undefined,
    _raw: proto,
  };
}

/**
 * Map a proto `PollOption` to the SDK `PollOption`.
 */
function mapPollOption(proto: ProtoPollOption): PollOption {
  return {
    text: proto.text,
    optionIdentifier: proto.optionIdentifier,
    creatorHandle: proto.creatorHandle,
  };
}

/**
 * Map a proto `PollVote` to the SDK `PollVote`.
 */
function mapPollVote(proto: ProtoPollVote): PollVote {
  return {
    optionIdentifier: proto.optionIdentifier,
    participantAddress: proto.participantAddress,
  };
}

/**
 * Map a proto `PollInfo` to the SDK `PollInfo`.
 */
export function mapPollInfo(proto: ProtoPollInfo): PollInfo {
  return {
    messageGuid: messageGuid(proto.messageGuid),
    chatGuid: chatGuid(proto.chatGuid),
    title: proto.title,
    options: proto.options.map(mapPollOption),
    votes: proto.votes.map(mapPollVote),
  };
}

/**
 * Map a proto `FindMyFriend` to the SDK `FindMyFriend`.
 *
 * ts-proto gives us `Date | undefined` for Timestamp fields.
 */
export function mapFindMyFriend(proto: ProtoFindMyFriend): FindMyFriend {
  return {
    id: proto.id,
    name: proto.name,
    latitude: proto.latitude,
    longitude: proto.longitude,
    accuracy: proto.accuracy,
    locationTimestamp: proto.locationTimestamp,
    longAddress: proto.longAddress,
    shortAddress: proto.shortAddress,
    isLocatingInProgress: proto.isLocatingInProgress,
    locationType: mapLocationType(proto.locationType),
    expiresAt: proto.expiresAt,
  };
}
