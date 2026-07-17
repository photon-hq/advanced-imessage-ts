import {
  ChatServiceType as ProtoChatServiceType,
  type MultiServiceAddressInfo as ProtoMultiServiceAddressInfo,
  type SingleServiceAddressInfo as ProtoSingleServiceAddressInfo,
} from "./generated/photon/imessage/v1/address_types.ts";
import {
  type AttachmentInfo as ProtoAttachmentInfo,
  type CompanionInfo as ProtoCompanionInfo,
  CompanionKind as ProtoCompanionKind,
  TransferState as ProtoTransferState,
} from "./generated/photon/imessage/v1/attachment_types.ts";
import type {
  Chat as ProtoChat,
  ChatChangeEvent as ProtoChatChangeEvent,
} from "./generated/photon/imessage/v1/chat_types.ts";
import type { GroupChangeEvent as ProtoGroupChangeEvent } from "./generated/photon/imessage/v1/group_types.ts";
import type { RequestFriendLocationSharingResponse as ProtoRequestFriendLocationSharingResponse } from "./generated/photon/imessage/v1/location_service.ts";
import {
  FriendLocationType as ProtoFriendLocationType,
  type SharedFriendLocation as ProtoSharedFriendLocation,
  type SharedFriendLocationUpdated as ProtoSharedFriendLocationUpdated,
} from "./generated/photon/imessage/v1/location_types.ts";
import {
  type EmbeddedMedia as ProtoEmbeddedMedia,
  type Message as ProtoMessage,
  type MessageAppliedReaction as ProtoMessageAppliedReaction,
  type MessageChangeEvent as ProtoMessageChangeEvent,
  type MessageContent as ProtoMessageContent,
  type MessageEdited as ProtoMessageEdited,
  MessageItemType as ProtoMessageItemType,
  type MessageMention as ProtoMessageMention,
  type MessagePart as ProtoMessagePart,
  type MessagePlacedSticker as ProtoMessagePlacedSticker,
  type MessageReaction as ProtoMessageReaction,
  type MessageReactionAdded as ProtoMessageReactionAdded,
  MessageReactionKind as ProtoMessageReactionKind,
  type MessageReactionRemoved as ProtoMessageReactionRemoved,
  type MessageRead as ProtoMessageRead,
  type MessageReceived as ProtoMessageReceived,
  type MessageUnsent as ProtoMessageUnsent,
  type ReplyTarget as ProtoReplyTarget,
  type StickerPlaced as ProtoStickerPlaced,
  type StickerPlacement as ProtoStickerPlacement,
  type TextFormat as ProtoTextFormat,
} from "./generated/photon/imessage/v1/message_types.ts";
import type {
  PollChangeEvent as ProtoPollChangeEvent,
  PollInfo as ProtoPollInfo,
  PollOption as ProtoPollOption,
  PollParticipantVote as ProtoPollParticipantVote,
} from "./generated/photon/imessage/v1/poll_types.ts";
import type {
  MultiServiceAddressInfo,
  SingleServiceAddressInfo,
} from "./types/addresses.ts";
import type { AttachmentInfo, CompanionInfo } from "./types/attachments.ts";
import type { Chat } from "./types/chats.ts";
import type {
  ChatServiceType,
  CompanionKind,
  MessageItemType,
  TransferState,
} from "./types/enums.ts";
import type {
  ChatEvent,
  EventContext,
  GroupChange,
  GroupEvent,
  MessageEvent,
  PollEvent,
} from "./types/events.ts";
import type {
  LocationRequestReceipt,
  SharedFriendLocation,
  SharedFriendLocationUpdated,
} from "./types/locations.ts";
import type {
  EmbeddedMedia,
  Message,
  MessageAppliedReaction,
  MessageContent,
  MessageMention,
  MessagePart,
  MessagePlacedSticker,
  MessageReaction,
  StickerPlacement,
  TextFormat,
  TextFormatInput,
} from "./types/messages.ts";
import type {
  Poll,
  PollChangeDelta,
  PollOption,
  PollParticipantVote,
} from "./types/polls.ts";
import { unwrap } from "./utils/unwrap.ts";

export function mapTransferState(proto: ProtoTransferState): TransferState {
  switch (proto) {
    case ProtoTransferState.TRANSFER_STATE_PENDING:
      return "pending";
    case ProtoTransferState.TRANSFER_STATE_TRANSFERRING:
      return "transferring";
    case ProtoTransferState.TRANSFER_STATE_FAILED:
      return "failed";
    case ProtoTransferState.TRANSFER_STATE_FINISHED:
      return "finished";
    default:
      return "unknown";
  }
}

export function mapCompanionKind(proto: ProtoCompanionKind): CompanionKind {
  switch (proto) {
    case ProtoCompanionKind.COMPANION_KIND_LIVE_PHOTO_VIDEO:
      return "live-photo-video";
    default:
      return "unknown";
  }
}

export function mapMessageItemType(
  proto: ProtoMessageItemType
): MessageItemType {
  switch (proto) {
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_NORMAL:
      return "normal";
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_PARTICIPANT_CHANGE:
      return "participantChange";
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_GROUP_NAME_CHANGE:
      return "groupNameChange";
    case ProtoMessageItemType.MESSAGE_ITEM_TYPE_CHAT_ACTION:
      return "chatAction";
    default:
      return "unknown";
  }
}

export function mapChatServiceType(
  proto: ProtoChatServiceType
): ChatServiceType {
  switch (proto) {
    case ProtoChatServiceType.CHAT_SERVICE_TYPE_IMESSAGE:
      return "iMessage";
    case ProtoChatServiceType.CHAT_SERVICE_TYPE_SMS:
      return "SMS";
    case ProtoChatServiceType.CHAT_SERVICE_TYPE_RCS:
      return "RCS";
    default:
      return "unknown";
  }
}

function mapFriendLocationType(
  proto: ProtoFriendLocationType
): SharedFriendLocation["locationType"] {
  switch (proto) {
    case ProtoFriendLocationType.FRIEND_LOCATION_TYPE_LEGACY:
      return "legacy";
    case ProtoFriendLocationType.FRIEND_LOCATION_TYPE_LIVE:
      return "live";
    case ProtoFriendLocationType.FRIEND_LOCATION_TYPE_SHALLOW:
      return "shallow";
    default:
      return "unknown";
  }
}

export function mapSingleServiceAddressInfo(
  proto: ProtoSingleServiceAddressInfo
): SingleServiceAddressInfo {
  return {
    address: proto.address,
    country: proto.country,
    service: mapChatServiceType(proto.service),
  };
}

export function mapMultiServiceAddressInfo(
  proto: ProtoMultiServiceAddressInfo
): MultiServiceAddressInfo {
  return {
    address: proto.address,
    country: proto.country ?? null,
    services: proto.services.map(mapChatServiceType),
  };
}

export function mapCompanionInfo(proto: ProtoCompanionInfo): CompanionInfo {
  return {
    fileName: proto.fileName,
    kind: mapCompanionKind(proto.kind),
    mimeType: proto.mimeType,
    totalBytes: proto.totalBytes,
  };
}

export function mapAttachmentInfo(proto: ProtoAttachmentInfo): AttachmentInfo {
  return {
    companionKind: proto.companionKind
      ? mapCompanionKind(proto.companionKind)
      : undefined,
    fileName: proto.fileName,
    guid: proto.guid,
    isHidden: proto.isHidden,
    isOutgoing: proto.isOutgoing,
    isSticker: proto.isSticker,
    mimeType: proto.mimeType,
    originalGuid: proto.originalGuid ? proto.originalGuid : undefined,
    totalBytes: proto.totalBytes,
    transferState: mapTransferState(proto.transferState),
    uti: proto.uti,
  };
}

export function mapTextFormat(proto: ProtoTextFormat): TextFormat {
  return {
    effectName: proto.effectName,
    length: proto.length,
    start: proto.start,
    type: proto.type,
  };
}

export function mapTextFormatInput(input: TextFormatInput): ProtoTextFormat {
  return {
    effectName: input.type === "effect" ? input.effect : undefined,
    length: input.length,
    start: input.start,
    type: input.type,
  };
}

export function mapMessageMention(proto: ProtoMessageMention): MessageMention {
  return {
    address: proto.address,
    length: proto.length,
    start: proto.start,
  };
}

export function mapMessageReaction(
  proto: ProtoMessageReaction
): MessageReaction {
  switch (proto.kind) {
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_LOVE:
      return { emoji: proto.emoji, kind: "love" };
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_LIKE:
      return { emoji: proto.emoji, kind: "like" };
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_DISLIKE:
      return { emoji: proto.emoji, kind: "dislike" };
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_LAUGH:
      return { emoji: proto.emoji, kind: "laugh" };
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_EMPHASIZE:
      return { emoji: proto.emoji, kind: "emphasize" };
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_QUESTION:
      return { emoji: proto.emoji, kind: "question" };
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_EMOJI:
      return { emoji: proto.emoji, kind: "emoji" };
    case ProtoMessageReactionKind.MESSAGE_REACTION_KIND_STICKER:
      return { emoji: proto.emoji, kind: "sticker" };
    default:
      return { emoji: proto.emoji, kind: "unknown" };
  }
}

export function mapStickerPlacement(
  proto: ProtoStickerPlacement
): StickerPlacement {
  return {
    rotation: proto.rotation,
    scale: proto.scale,
    width: proto.width,
    x: proto.x,
    y: proto.y,
  };
}

export function mapMessageContent(proto: ProtoMessageContent): MessageContent {
  return {
    attachments: proto.attachments.map(mapAttachmentInfo),
    balloonBundleId: proto.balloonBundleId,
    expressiveSendStyleId: proto.expressiveSendStyleId,
    formatting: proto.formatting.map(mapTextFormat),
    mentions: proto.mentions.map(mapMessageMention),
    text: proto.text,
  };
}

export function mapAppliedReaction(
  proto: ProtoMessageAppliedReaction
): MessageAppliedReaction {
  return {
    dateCreated: unwrap(proto.dateCreated, "dateCreated"),
    isFromMe: proto.isFromMe,
    messageGuid: proto.messageGuid,
    reaction: mapMessageReaction(unwrap(proto.reaction, "reaction")),
    sender: proto.sender
      ? mapSingleServiceAddressInfo(proto.sender)
      : undefined,
    targetPartIndex: proto.targetPartIndex,
  };
}

export function mapPlacedSticker(
  proto: ProtoMessagePlacedSticker
): MessagePlacedSticker {
  return {
    dateCreated: unwrap(proto.dateCreated, "dateCreated"),
    isFromMe: proto.isFromMe,
    messageGuid: proto.messageGuid,
    placement: proto.placement
      ? mapStickerPlacement(proto.placement)
      : undefined,
    sender: proto.sender
      ? mapSingleServiceAddressInfo(proto.sender)
      : undefined,
    sticker: proto.sticker ? mapAttachmentInfo(proto.sticker) : undefined,
    targetPartIndex: proto.targetPartIndex,
  };
}

export function mapMessage(proto: ProtoMessage): Message {
  return {
    appliedReactions: proto.appliedReactions.map(mapAppliedReaction),
    cachedRoomNames: proto.cachedRoomNames,
    chatActionType: proto.chatActionType,
    chatGuids: proto.chatGuids,
    content: mapMessageContent(unwrap(proto.content, "content")),
    dataDetectorResultsPresent: proto.dataDetectorResultsPresent,
    dateCreated: unwrap(proto.dateCreated, "dateCreated"),
    dateDelivered: proto.dateDelivered,
    dateEdited: proto.dateEdited,
    dateExpressiveSendPlayed: proto.dateExpressiveSendPlayed,
    datePlayed: proto.datePlayed,
    dateRead: proto.dateRead,
    dateRetracted: proto.dateRetracted,
    destinationCallerId: proto.destinationCallerId,
    didNotifyRecipient: proto.didNotifyRecipient,
    groupTitle: proto.groupTitle,
    guid: proto.guid,
    isArchived: proto.isArchived,
    isAudioMessage: proto.isAudioMessage,
    isAutoReply: proto.isAutoReply,
    isCorrupt: proto.isCorrupt,
    isDelayed: proto.isDelayed,
    isDelivered: proto.isDelivered,
    isDeliveredQuietly: proto.isDeliveredQuietly,
    isExpirable: proto.isExpirable,
    isForward: proto.isForward,
    isFromMe: proto.isFromMe,
    isSent: proto.isSent,
    isServiceMessage: proto.isServiceMessage,
    isSpam: proto.isSpam,
    isSystemMessage: proto.isSystemMessage,
    itemType: mapMessageItemType(proto.itemType),
    partCount: proto.partCount,
    placedStickers: proto.placedStickers.map(mapPlacedSticker),
    reaction: proto.reaction ? mapMessageReaction(proto.reaction) : undefined,
    reactionSelected: proto.reactionSelected,
    reactionTargetGuid: proto.reactionTargetGuid,
    reactionTargetPartIndex: proto.reactionTargetPartIndex,
    replyTargetGuid: proto.replyTargetGuid,
    sendErrorCode: proto.sendErrorCode,
    sender: proto.sender
      ? mapSingleServiceAddressInfo(proto.sender)
      : undefined,
    shareDirection: proto.shareDirection,
    shareStatus: proto.shareStatus,
    subject: proto.subject,
    threadOriginatorGuid: proto.threadOriginatorGuid,
    threadOriginatorPart: proto.threadOriginatorPart,
  };
}

export function mapChat(proto: ProtoChat): Chat {
  return {
    chatIdentifier: proto.chatIdentifier,
    displayName: proto.displayName ?? "",
    groupId: proto.groupId,
    guid: proto.guid,
    isArchived: proto.isArchived,
    isFiltered: proto.isFiltered,
    isGroup: proto.isGroup,
    lastMessage: proto.lastMessage ? mapMessage(proto.lastMessage) : undefined,
    participants: proto.participants.map(mapSingleServiceAddressInfo),
    service: mapChatServiceType(proto.service),
    unreadCount: proto.unreadCount,
  };
}

export function mapPollOption(proto: ProtoPollOption): PollOption {
  return {
    creatorHandle: proto.creatorHandle,
    optionIdentifier: proto.optionIdentifier,
    text: proto.text,
  };
}

export function mapPollParticipantVote(
  proto: ProtoPollParticipantVote
): PollParticipantVote {
  return {
    optionIdentifier: proto.optionIdentifier,
    participant: mapSingleServiceAddressInfo(
      unwrap(proto.participant, "participant")
    ),
  };
}

export function mapPoll(proto: ProtoPollInfo): Poll {
  return {
    chatGuid: proto.chatGuid,
    options: proto.options.map(mapPollOption),
    pollMessageGuid: proto.pollMessageGuid,
    title: proto.title,
    votes: proto.votes.map(mapPollParticipantVote),
  };
}

export function mapPollDelta(
  proto: ProtoPollChangeEvent
): PollChangeDelta | undefined {
  if (proto.created) {
    return {
      type: "created",
      title: proto.created.title,
      options: proto.created.options.map(mapPollOption),
    };
  }
  if (proto.optionAdded) {
    return {
      type: "optionAdded",
      title: proto.optionAdded.title,
      options: proto.optionAdded.options.map(mapPollOption),
    };
  }
  if (proto.voted) {
    return {
      type: "voted",
      optionIdentifier: proto.voted.optionIdentifier,
    };
  }
  if (proto.unvoted) {
    return {
      type: "unvoted",
      optionIdentifier: proto.unvoted.optionIdentifier,
    };
  }
  return undefined;
}

export function mapSharedFriendLocation(
  proto: ProtoSharedFriendLocation
): SharedFriendLocation {
  return {
    accuracy: proto.accuracy,
    address: proto.address,
    expiresAt: proto.expiresAt,
    isLocatingInProgress: proto.isLocatingInProgress,
    latitude: proto.latitude,
    locationTimestamp: proto.locationTimestamp,
    locationType: mapFriendLocationType(proto.locationType),
    longAddress: proto.longAddress,
    longitude: proto.longitude,
    name: proto.name,
    shortAddress: proto.shortAddress,
  };
}

export function mapSharedFriendLocationUpdated(
  proto: ProtoSharedFriendLocationUpdated
): SharedFriendLocationUpdated {
  return {
    location: mapSharedFriendLocation(unwrap(proto.location, "location")),
    sourceSequence: proto.sourceSequence,
  };
}

export function mapLocationRequestReceipt(
  proto: ProtoRequestFriendLocationSharingResponse
): LocationRequestReceipt {
  return {
    address: proto.address,
    messageGuid: proto.messageGuid,
    reason: proto.reason,
    status: proto.status,
  };
}

export function mapEmbeddedMedia(proto: ProtoEmbeddedMedia): EmbeddedMedia {
  return {
    data: proto.data,
    mimeType: proto.mimeType,
  };
}

export function mapEventContext(
  chatGuidValue: string,
  occurredAt: Date,
  isFromMe: boolean,
  actor?: ProtoSingleServiceAddressInfo
): EventContext {
  return {
    actor: actor ? mapSingleServiceAddressInfo(actor) : undefined,
    chatGuid: chatGuidValue,
    isFromMe,
    occurredAt,
  };
}

export function mapChatEvent(
  sequence: number,
  proto: ProtoChatChangeEvent
): ChatEvent | undefined {
  const context = mapEventContext(
    proto.chatGuid,
    unwrap(proto.occurredAt, "occurredAt"),
    proto.isFromMe,
    proto.actor
  );
  if (proto.backgroundChanged) {
    return { type: "chat.backgroundChanged", sequence, ...context };
  }
  if (proto.backgroundRemoved) {
    return { type: "chat.backgroundRemoved", sequence, ...context };
  }
  if (proto.markedRead) {
    return { type: "chat.markedRead", sequence, ...context };
  }
  if (proto.archived) {
    return { type: "chat.archived", sequence, ...context };
  }
  if (proto.unarchived) {
    return { type: "chat.unarchived", sequence, ...context };
  }
  return undefined;
}

export function mapGroupChange(
  proto: ProtoGroupChangeEvent
): GroupChange | undefined {
  if (proto.displayNameChanged) {
    return {
      type: "displayNameChanged",
      displayName: proto.displayNameChanged.displayName,
    };
  }
  if (proto.participantAdded) {
    return {
      type: "participantAdded",
      participant: mapSingleServiceAddressInfo(
        unwrap(proto.participantAdded.participant, "participant")
      ),
    };
  }
  if (proto.participantRemoved) {
    return {
      type: "participantRemoved",
      participant: mapSingleServiceAddressInfo(
        unwrap(proto.participantRemoved.participant, "participant")
      ),
    };
  }
  if (proto.participantLeft) {
    return {
      type: "participantLeft",
      participant: mapSingleServiceAddressInfo(
        unwrap(proto.participantLeft.participant, "participant")
      ),
    };
  }
  if (proto.iconChanged) {
    return { type: "iconChanged" };
  }
  if (proto.iconRemoved) {
    return { type: "iconRemoved" };
  }
  return undefined;
}

export function mapGroupEvent(
  sequence: number,
  proto: ProtoGroupChangeEvent
): GroupEvent | undefined {
  const change = mapGroupChange(proto);
  if (!change) {
    return undefined;
  }
  return {
    type: "group.changed",
    sequence,
    ...mapEventContext(
      proto.chatGuid,
      unwrap(proto.occurredAt, "occurredAt"),
      proto.isFromMe,
      proto.actor
    ),
    change,
  };
}

function mapReceivedMessage(
  sequence: number,
  context: EventContext,
  proto: ProtoMessageReceived
): MessageEvent {
  return {
    type: "message.received",
    sequence,
    ...context,
    message: mapMessage(unwrap(proto.message, "message")),
  };
}

function mapEditedMessage(
  sequence: number,
  context: EventContext,
  proto: ProtoMessageEdited
): MessageEvent {
  return {
    type: "message.edited",
    sequence,
    ...context,
    messageGuid: proto.messageGuid,
    content: mapMessageContent(unwrap(proto.content, "content")),
    editedAt: unwrap(proto.editedAt, "editedAt"),
  };
}

function mapReadMessage(
  sequence: number,
  context: EventContext,
  proto: ProtoMessageRead
): MessageEvent {
  return {
    type: "message.read",
    sequence,
    ...context,
    messageGuid: proto.messageGuid,
    readAt: unwrap(proto.readAt, "readAt"),
  };
}

function mapUnsentMessage(
  sequence: number,
  context: EventContext,
  proto: ProtoMessageUnsent
): MessageEvent {
  return {
    type: "message.unsent",
    sequence,
    ...context,
    messageGuid: proto.messageGuid,
    retractedAt: unwrap(proto.retractedAt, "retractedAt"),
  };
}

function mapReactionAdded(
  sequence: number,
  context: EventContext,
  proto: ProtoMessageReactionAdded
): MessageEvent {
  return {
    type: "message.reactionAdded",
    sequence,
    ...context,
    messageGuid: proto.messageGuid,
    reaction: mapMessageReaction(unwrap(proto.reaction, "reaction")),
    targetPartIndex: proto.targetPartIndex,
  };
}

function mapReactionRemoved(
  sequence: number,
  context: EventContext,
  proto: ProtoMessageReactionRemoved
): MessageEvent {
  return {
    type: "message.reactionRemoved",
    sequence,
    ...context,
    messageGuid: proto.messageGuid,
    reaction: mapMessageReaction(unwrap(proto.reaction, "reaction")),
    targetPartIndex: proto.targetPartIndex,
  };
}

function mapStickerPlacedEvent(
  sequence: number,
  context: EventContext,
  proto: ProtoStickerPlaced
): MessageEvent {
  return {
    type: "message.stickerPlaced",
    sequence,
    ...context,
    messageGuid: proto.messageGuid,
    placement: proto.placement
      ? mapStickerPlacement(proto.placement)
      : undefined,
    sticker: proto.sticker ? mapAttachmentInfo(proto.sticker) : undefined,
    targetPartIndex: proto.targetPartIndex,
  };
}

export function mapMessageEvent(
  sequence: number,
  proto: ProtoMessageChangeEvent
): MessageEvent | undefined {
  const context = mapEventContext(
    proto.chatGuid,
    unwrap(proto.occurredAt, "occurredAt"),
    proto.isFromMe,
    proto.actor
  );
  if (proto.messageReceived) {
    return mapReceivedMessage(sequence, context, proto.messageReceived);
  }
  if (proto.messageEdited) {
    return mapEditedMessage(sequence, context, proto.messageEdited);
  }
  if (proto.messageRead) {
    return mapReadMessage(sequence, context, proto.messageRead);
  }
  if (proto.messageUnsent) {
    return mapUnsentMessage(sequence, context, proto.messageUnsent);
  }
  if (proto.reactionAdded) {
    return mapReactionAdded(sequence, context, proto.reactionAdded);
  }
  if (proto.reactionRemoved) {
    return mapReactionRemoved(sequence, context, proto.reactionRemoved);
  }
  if (proto.stickerPlaced) {
    return mapStickerPlacedEvent(sequence, context, proto.stickerPlaced);
  }
  return undefined;
}

export function mapPollEvent(
  sequence: number,
  proto: ProtoPollChangeEvent
): PollEvent | undefined {
  const delta = mapPollDelta(proto);
  if (!delta) {
    return undefined;
  }
  return {
    type: "poll.changed",
    sequence,
    ...mapEventContext(
      proto.chatGuid,
      unwrap(proto.occurredAt, "occurredAt"),
      proto.isFromMe,
      proto.actor
    ),
    delta,
    pollMessageGuid: proto.pollMessageGuid,
  };
}

export function mapReplyTarget(
  replyTo:
    | string
    | { readonly guid: string; readonly partIndex?: number }
    | undefined
): ProtoReplyTarget | undefined {
  if (!replyTo) {
    return undefined;
  }
  if (typeof replyTo === "string") {
    return { messageGuid: replyTo, targetPartIndex: undefined };
  }
  return {
    messageGuid: replyTo.guid,
    targetPartIndex: replyTo.partIndex,
  };
}

export function mapOutgoingMessagePart(part: MessagePart): ProtoMessagePart {
  return {
    attachment: part.attachmentGuid
      ? {
          attachmentGuid: part.attachmentGuid,
          attachmentName: part.attachmentName,
        }
      : undefined,
    bubbleIndex: part.bubbleIndex,
    formatting: (part.formatting ?? []).map(mapTextFormatInput),
    mentionedAddress: part.mentionedAddress,
    text: part.text,
  };
}
