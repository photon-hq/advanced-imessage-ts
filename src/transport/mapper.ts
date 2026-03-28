/**
 * Mapper functions that convert between generated protobuf types and SDK
 * public domain types.
 *
 * Every generated proto type is imported with a `Proto` prefix to clearly
 * distinguish it from the handwritten SDK type of the same name.
 */

// ---------------------------------------------------------------------------
// Generated proto imports
// ---------------------------------------------------------------------------

import type { Timestamp as ProtoTimestamp } from "../generated/google/protobuf/timestamp.ts";
import {
  Timestamp as ProtoTimestampType,
} from "../generated/google/protobuf/timestamp.ts";

import {
  type AddressInfo as ProtoAddressInfo,
  type AttachmentInfo as ProtoAttachmentInfo,
  type Message as ProtoMessage,
  TransferState as ProtoTransferState,
  MessageItemType as ProtoMessageItemType,
} from "../generated/photon/imessage/v1/message_service.ts";

import {
  type Chat as ProtoChat,
} from "../generated/photon/imessage/v1/chat_service.ts";

import {
  type PollInfo as ProtoPollInfo,
  type PollOption as ProtoPollOption,
  type PollVote as ProtoPollVote,
} from "../generated/photon/imessage/v1/poll_service.ts";

import {
  type ScheduledMessage as ProtoScheduledMessage,
  ScheduledMessageStatus as ProtoScheduledMessageStatus,
  ScheduledMessageType as ProtoScheduledMessageType,
} from "../generated/photon/imessage/v1/scheduled_message_service.ts";

import {
  type FindMyFriend as ProtoFindMyFriend,
  FindMyLocationType as ProtoFindMyLocationType,
} from "../generated/photon/imessage/v1/location_service.ts";

import {
  SortDirection as ProtoSortDirection,
} from "../generated/photon/imessage/v1/common.ts";

// ---------------------------------------------------------------------------
// SDK type imports
// ---------------------------------------------------------------------------

import {
  chatGuid,
  messageGuid,
  attachmentGuid,
  scheduledMessageId,
} from "../types/branded.ts";

import type {
  TransferState,
  MessageItemType,
  ChatServiceType,
  ScheduledMessageStatus,
  SortDirection,
} from "../types/enums.ts";

import type { Message } from "../types/messages.ts";
import type { Chat } from "../types/chats.ts";
import type { AddressInfo } from "../types/addresses.ts";
import type { AttachmentInfo } from "../types/attachments.ts";
import type { PollInfo, PollOption, PollVote } from "../types/polls.ts";
import type { ScheduledMessage } from "../types/scheduled-messages.ts";
import type { FindMyFriend } from "../types/locations.ts";

// ---------------------------------------------------------------------------
// Timestamp conversion
// ---------------------------------------------------------------------------

/**
 * Convert a proto Timestamp to a JavaScript `Date`.
 *
 * Returns `undefined` if the input is `undefined`.
 */
export function timestampToDate(ts: ProtoTimestamp): Date {
  return ProtoTimestampType.toDate(ts);
}

/**
 * Convert a JavaScript `Date` to a proto Timestamp.
 */
export function dateToTimestamp(date: Date): ProtoTimestamp {
  return ProtoTimestampType.fromDate(date);
}

/**
 * Safely convert an optional proto Timestamp to a Date.
 */
function optionalTimestamp(ts: ProtoTimestamp | undefined): Date | undefined {
  return ts ? timestampToDate(ts) : undefined;
}

// ---------------------------------------------------------------------------
// Enum conversion: proto -> SDK
// ---------------------------------------------------------------------------

/**
 * Map a proto `TransferState` enum value to the SDK string literal.
 */
export function mapTransferState(proto: ProtoTransferState): TransferState {
  switch (proto) {
    case ProtoTransferState.TRANSFERRING:
      return "transferring";
    case ProtoTransferState.FAILED:
      return "failed";
    case ProtoTransferState.FINISHED:
      return "finished";
    case ProtoTransferState.PENDING:
      return "pending";
    case ProtoTransferState.UNSPECIFIED:
    default:
      return "pending";
  }
}

/**
 * Map a proto `MessageItemType` enum value to the SDK string literal.
 */
export function mapMessageItemType(
  proto: ProtoMessageItemType,
): MessageItemType {
  switch (proto) {
    case ProtoMessageItemType.NORMAL:
      return "normal";
    case ProtoMessageItemType.GROUP_NAME_CHANGE:
      return "groupNameChange";
    case ProtoMessageItemType.PARTICIPANT_CHANGE:
      return "participantChange";
    case ProtoMessageItemType.LEFT_GROUP:
      return "leftGroup";
    case ProtoMessageItemType.UNSPECIFIED:
    default:
      return "normal";
  }
}

/**
 * Map a proto `ScheduledMessageStatus` enum value to the SDK string literal.
 */
function mapScheduledMessageStatus(
  proto: ProtoScheduledMessageStatus,
): ScheduledMessageStatus {
  switch (proto) {
    case ProtoScheduledMessageStatus.PENDING:
      return "pending";
    case ProtoScheduledMessageStatus.IN_PROGRESS:
      return "inProgress";
    case ProtoScheduledMessageStatus.COMPLETE:
      return "complete";
    case ProtoScheduledMessageStatus.FAILED:
      return "failed";
    case ProtoScheduledMessageStatus.UNSPECIFIED:
    default:
      return "pending";
  }
}

/**
 * Map a proto `ScheduledMessageType` enum value to a string.
 */
function mapScheduledMessageType(proto: ProtoScheduledMessageType): string {
  switch (proto) {
    case ProtoScheduledMessageType.SEND_MESSAGE:
      return "sendMessage";
    case ProtoScheduledMessageType.UNSPECIFIED:
    default:
      return "unspecified";
  }
}

/**
 * Map a proto `FindMyLocationType` enum value to the SDK string literal.
 */
function mapLocationType(
  proto: ProtoFindMyLocationType,
): "live" | "shallow" {
  switch (proto) {
    case ProtoFindMyLocationType.LIVE:
      return "live";
    case ProtoFindMyLocationType.SHALLOW:
      return "shallow";
    case ProtoFindMyLocationType.UNSPECIFIED:
    default:
      return "shallow";
  }
}

/**
 * Map a proto service string to the SDK `ChatServiceType`.
 */
function mapChatServiceType(service: string): ChatServiceType {
  if (service === "SMS") return "SMS";
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
      return ProtoSortDirection.ASCENDING;
    case "descending":
      return ProtoSortDirection.DESCENDING;
    default:
      return ProtoSortDirection.UNSPECIFIED;
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
 */
export function mapMessage(proto: ProtoMessage): Message {
  return {
    guid: messageGuid(proto.guid),
    clientMessageId: proto.clientMessageId,

    // Content
    text: proto.text,
    subject: proto.subject,

    // Timeline
    dateCreated: proto.dateCreated
      ? timestampToDate(proto.dateCreated)
      : new Date(0),
    dateRead: optionalTimestamp(proto.dateRead),
    dateDelivered: optionalTimestamp(proto.dateDelivered),
    dateEdited: optionalTimestamp(proto.dateEdited),
    dateRetracted: optionalTimestamp(proto.dateRetracted),
    datePlayed: optionalTimestamp(proto.datePlayed),

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
    replyToGuid: proto.replyToGuid
      ? messageGuid(proto.replyToGuid)
      : undefined,

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
    lastMessage: proto.lastMessage
      ? mapMessage(proto.lastMessage)
      : undefined,
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
 * Map a proto `ScheduledMessage` to the SDK `ScheduledMessage`.
 */
export function mapScheduledMessage(
  proto: ProtoScheduledMessage,
): ScheduledMessage {
  return {
    id: scheduledMessageId(proto.id),
    type: mapScheduledMessageType(proto.type),
    payload: proto.payload,
    scheduledFor: proto.scheduledFor
      ? timestampToDate(proto.scheduledFor)
      : new Date(0),
    schedule: proto.schedule,
    status: mapScheduledMessageStatus(proto.status),
    errorMessage: proto.errorMessage,
    sentAt: optionalTimestamp(proto.sentAt),
    createdAt: proto.createdAt
      ? timestampToDate(proto.createdAt)
      : new Date(0),
  };
}

/**
 * Map a proto `FindMyFriend` to the SDK `FindMyFriend`.
 */
export function mapFindMyFriend(proto: ProtoFindMyFriend): FindMyFriend {
  return {
    id: proto.id,
    name: proto.name,
    latitude: proto.latitude,
    longitude: proto.longitude,
    accuracy: proto.accuracy,
    locationTimestamp: optionalTimestamp(proto.locationTimestamp),
    longAddress: proto.longAddress,
    shortAddress: proto.shortAddress,
    isLocatingInProgress: proto.isLocatingInProgress,
    locationType: mapLocationType(proto.locationType),
    expiresAt: optionalTimestamp(proto.expiresAt),
  };
}
