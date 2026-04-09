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
import {
  type ScheduledMessage as ProtoScheduledMessage,
  ScheduledMessageStatus as ProtoScheduledMessageStatus,
  ScheduledMessageType as ProtoScheduledMessageType,
} from "../generated/photon/imessage/v1/scheduled_message_service.ts";

// ---------------------------------------------------------------------------
// SDK type imports
// ---------------------------------------------------------------------------

import type { AddressInfo } from "../types/addresses.ts";
import type { AttachmentInfo } from "../types/attachments.ts";
import {
  attachmentGuid,
  chatGuid,
  messageGuid,
  scheduledMessageId,
} from "../types/branded.ts";
import type { Chat } from "../types/chats.ts";
import type {
  ChatServiceType,
  MessageItemType,
  ScheduledMessageStatus,
  SortDirection,
  TransferState,
} from "../types/enums.ts";
import type { FindMyFriend } from "../types/locations.ts";
import type { Message, MessageContent } from "../types/messages.ts";
import type { PollInfo, PollOption, PollVote } from "../types/polls.ts";
import type { Reaction } from "../types/reactions.ts";
import type { ScheduledMessage } from "../types/scheduled-messages.ts";
import {
  decompressPayload,
  extractCheckin,
  extractCollaboration,
  extractLocationShare,
  extractOriginalText,
  extractRichLink,
} from "../utils/payload.ts";

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
 * Map a proto `ScheduledMessageStatus` enum value to the SDK string literal.
 */
function mapScheduledMessageStatus(
  proto: ProtoScheduledMessageStatus
): ScheduledMessageStatus {
  switch (proto) {
    case ProtoScheduledMessageStatus.SCHEDULED_MESSAGE_STATUS_PENDING:
      return "pending";
    case ProtoScheduledMessageStatus.SCHEDULED_MESSAGE_STATUS_IN_PROGRESS:
      return "inProgress";
    case ProtoScheduledMessageStatus.SCHEDULED_MESSAGE_STATUS_COMPLETE:
      return "complete";
    case ProtoScheduledMessageStatus.SCHEDULED_MESSAGE_STATUS_FAILED:
      return "failed";
    default:
      return "pending";
  }
}

/**
 * Map a proto `ScheduledMessageType` enum value to a string.
 */
function mapScheduledMessageType(proto: ProtoScheduledMessageType): string {
  switch (proto) {
    case ProtoScheduledMessageType.SCHEDULED_MESSAGE_TYPE_SEND_MESSAGE:
      return "sendMessage";
    default:
      return "unspecified";
  }
}

/**
 * Map a proto `FindMyLocationType` enum value to the SDK string literal.
 */
function mapLocationType(proto: ProtoFindMyLocationType): "live" | "shallow" {
  switch (proto) {
    case ProtoFindMyLocationType.FIND_MY_LOCATION_TYPE_LIVE:
      return "live";
    case ProtoFindMyLocationType.FIND_MY_LOCATION_TYPE_SHALLOW:
      return "shallow";
    default:
      return "shallow";
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

// ---------------------------------------------------------------------------
// Content resolution
// ---------------------------------------------------------------------------

/** 2000-2005 = add, 3000-3005 = remove. Last digit indexes into this array. */
const TAPBACK_REACTIONS: readonly Reaction[] = [
  "love",
  "like",
  "dislike",
  "laugh",
  "emphasize",
  "question",
];

const TAPBACK_PART_RE = /^p:(\d+)\//;

const BALLOON_RICH_LINK = "com.apple.messages.URLBalloonProvider";
const BALLOON_CHECKIN =
  "com.apple.SafetyMonitorPlugin.SafetyMonitorMessageExtension";
const BALLOON_LOCATION = "com.apple.locationsharing";
const BALLOON_POLL = "com.apple.messages.PollBalloonProvider";
const BALLOON_COLLAB_PREFIX =
  "com.apple.messages.MSMessageExtensionBalloonPlugin:";

const IMAGE_SUBTYPE_MAP: Record<
  string,
  "gif" | "png" | "heic" | "jpeg" | "webp"
> = {
  "image/gif": "gif",
  "image/png": "png",
  "image/heic": "heic",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

/** Priority: unsend > reaction > edit > system > balloon > attachment > text > unknown */
function resolveContent(
  proto: ProtoMessage,
  mappedAttachments: readonly AttachmentInfo[]
): MessageContent {
  if (proto.dateRetracted) {
    return { type: "unsend", retractedAt: proto.dateRetracted };
  }

  const reactionResult = resolveReaction(proto);
  if (reactionResult) {
    return reactionResult;
  }

  if (proto.dateEdited) {
    return resolveEdit(proto);
  }

  if (
    proto.isSystemMessage ||
    proto.itemType !== ProtoMessageItemType.MESSAGE_ITEM_TYPE_NORMAL
  ) {
    return resolveSystem(proto);
  }

  const balloonResult = resolveBalloon(proto);
  if (balloonResult) {
    return balloonResult;
  }

  const attachmentResult = resolveAttachment(proto, mappedAttachments);
  if (attachmentResult) {
    return attachmentResult;
  }

  if (proto.text) {
    return {
      type: "text",
      text: proto.text,
      effect: proto.expressiveSendStyleId,
    };
  }

  return { type: "unknown" };
}

function resolveReaction(proto: ProtoMessage): MessageContent | undefined {
  if (!proto.associatedMessageType) {
    return undefined;
  }

  const code = Number.parseInt(proto.associatedMessageType, 10);
  if (Number.isNaN(code) || code < 2000 || code > 3005) {
    return undefined;
  }

  const isRemoval = code >= 3000;
  const reactionIdx = (code % 1000) % 6;
  const reaction = TAPBACK_REACTIONS[reactionIdx] ?? "love";

  let targetGuid = proto.associatedMessageGuid ?? "";
  let targetPart = 0;
  const partMatch = TAPBACK_PART_RE.exec(targetGuid);
  if (partMatch) {
    targetPart = Number.parseInt(partMatch[1] ?? "0", 10);
    targetGuid = targetGuid.slice(partMatch[0].length);
  }

  return {
    type: "reaction",
    reaction,
    emoji: proto.associatedMessageEmoji,
    isRemoval,
    targetGuid: messageGuid(targetGuid),
    targetPart,
  };
}

function resolveEdit(proto: ProtoMessage): MessageContent {
  const originalText = proto.messageSummaryInfo
    ? extractOriginalText(proto.messageSummaryInfo)
    : undefined;
  return {
    type: "edit",
    editedAt: proto.dateEdited ?? new Date(0),
    newText: proto.text ?? "",
    originalText,
  };
}

function resolveSystem(proto: ProtoMessage): MessageContent {
  const itemType = mapMessageItemType(proto.itemType);
  const systemType = itemType === "normal" ? "other" : itemType;
  return { type: "system", groupTitle: proto.groupTitle, systemType };
}

function resolveBalloon(proto: ProtoMessage): MessageContent | undefined {
  if (!proto.balloonBundleId) {
    return undefined;
  }

  const balloon = proto.balloonBundleId;
  const rawPayload = proto.payloadData;

  if (balloon === BALLOON_RICH_LINK) {
    return resolveRichLink(rawPayload);
  }
  if (balloon === BALLOON_CHECKIN) {
    return resolveCheckin(rawPayload);
  }
  if (balloon === BALLOON_LOCATION) {
    return resolveLocationShare(rawPayload);
  }
  if (balloon === BALLOON_POLL) {
    return { type: "poll", pollMessageGuid: messageGuid(proto.guid) };
  }
  if (balloon.startsWith(BALLOON_COLLAB_PREFIX)) {
    return resolveCollaboration(balloon, rawPayload);
  }
  return undefined;
}

function resolveAttachment(
  proto: ProtoMessage,
  mappedAttachments: readonly AttachmentInfo[]
): MessageContent | undefined {
  const first = mappedAttachments[0];
  if (!first) {
    return undefined;
  }

  if (first.isSticker) {
    return { type: "sticker", attachment: first };
  }

  const mime = first.mimeType.toLowerCase();

  if (mime === "text/vcard" || mime === "text/x-vcard") {
    return { type: "contact", attachmentGuid: first.guid };
  }
  if (mime.startsWith("image/")) {
    return {
      type: "image",
      attachment: first,
      height: first.height,
      subtype: IMAGE_SUBTYPE_MAP[mime],
      width: first.width,
    };
  }
  if (mime.startsWith("video/")) {
    return {
      type: "video",
      attachment: first,
      height: first.height,
      width: first.width,
    };
  }
  if (mime.startsWith("audio/")) {
    return {
      type: "audio",
      attachment: first,
      isVoiceMessage: proto.isAudioMessage,
    };
  }
  return { type: "file", attachment: first };
}

function tryDecompress(rawPayload: Uint8Array | undefined): Uint8Array | null {
  if (!rawPayload || rawPayload.length === 0) {
    return null;
  }
  return decompressPayload(rawPayload);
}

function resolveRichLink(rawPayload: Uint8Array | undefined): MessageContent {
  const decompressed = tryDecompress(rawPayload);
  if (!decompressed) {
    return { type: "richLink", raw: rawPayload };
  }
  const extracted = extractRichLink(decompressed);
  return {
    type: "richLink",
    url: extracted.url,
    title: extracted.title,
    summary: extracted.summary,
    imageUrl: extracted.imageUrl,
    raw: extracted.url ? undefined : rawPayload,
  };
}

function resolveCheckin(rawPayload: Uint8Array | undefined): MessageContent {
  const decompressed = tryDecompress(rawPayload);
  if (!decompressed) {
    return {
      type: "checkin",
      mode: "unknown",
      status: "unknown",
      raw: rawPayload,
    };
  }
  const extracted = extractCheckin(decompressed);
  return {
    type: "checkin",
    mode: extracted.mode,
    status: extracted.status,
    sessionId: extracted.sessionId,
    estimatedEndTime: extracted.estimatedEndTime,
    destinationName: extracted.destinationName,
    raw:
      extracted.mode === "unknown" && extracted.status === "unknown"
        ? rawPayload
        : undefined,
  };
}

function resolveLocationShare(
  rawPayload: Uint8Array | undefined
): MessageContent {
  const decompressed = tryDecompress(rawPayload);
  if (!decompressed) {
    return { type: "locationShare", kind: "unknown", raw: rawPayload };
  }
  const extracted = extractLocationShare(decompressed);
  return {
    type: "locationShare",
    kind: extracted.kind,
    coordinates:
      extracted.latitude != null && extracted.longitude != null
        ? { latitude: extracted.latitude, longitude: extracted.longitude }
        : undefined,
    address: extracted.address,
    mapsUrl: extracted.mapsUrl,
    raw: extracted.kind === "unknown" ? rawPayload : undefined,
  };
}

function resolveCollaboration(
  balloonBundleId: string,
  rawPayload: Uint8Array | undefined
): MessageContent {
  const bundleId = balloonBundleId.slice(BALLOON_COLLAB_PREFIX.length);
  const decompressed = tryDecompress(rawPayload);
  if (!decompressed) {
    return { type: "collaboration", bundleId, raw: rawPayload };
  }
  const extracted = extractCollaboration(decompressed);
  return {
    type: "collaboration",
    appName: extracted.appName,
    url: extracted.url,
    bundleId,
    raw: extracted.appName || extracted.url ? undefined : rawPayload,
  };
}

// ---------------------------------------------------------------------------
// Domain type mappers: proto -> SDK (continued)
// ---------------------------------------------------------------------------

/**
 * Map a proto `Message` to the SDK `Message`.
 *
 * ts-proto generates `Date | undefined` for all Timestamp fields, so we
 * pass them through directly instead of converting from a proto Timestamp
 * object.
 */
export function mapMessage(proto: ProtoMessage): Message {
  const mappedAttachments = proto.attachments.map(mapAttachmentInfo);

  return {
    guid: messageGuid(proto.guid),
    clientMessageId: proto.clientMessageId,

    // Content
    content: resolveContent(proto, mappedAttachments),
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
    attachments: mappedAttachments,
    chatGuids: proto.chatGuids.map(chatGuid),

    // Threading
    threadOriginatorGuid: proto.threadOriginatorGuid
      ? messageGuid(proto.threadOriginatorGuid)
      : undefined,
    threadOriginatorPart: proto.threadOriginatorPart,

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
 * Map a proto `ScheduledMessage` to the SDK `ScheduledMessage`.
 *
 * ts-proto gives us `Date | undefined` for Timestamp fields.
 */
export function mapScheduledMessage(
  proto: ProtoScheduledMessage
): ScheduledMessage {
  return {
    id: scheduledMessageId(proto.id),
    type: mapScheduledMessageType(proto.type),
    payload: proto.payload,
    scheduledFor: proto.scheduledFor ?? new Date(0),
    schedule: proto.schedule,
    status: mapScheduledMessageStatus(proto.status),
    errorMessage: proto.errorMessage,
    sentAt: proto.sentAt,
    createdAt: proto.createdAt ?? new Date(0),
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
