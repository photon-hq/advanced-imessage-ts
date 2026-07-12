import { ChatChangeEvent as ProtoChatChangeEvent } from "../generated/photon/imessage/v1/chat_types.ts";
import { GroupChangeEvent as ProtoGroupChangeEvent } from "../generated/photon/imessage/v1/group_types.ts";
import { MessageChangeEvent as ProtoMessageChangeEvent } from "../generated/photon/imessage/v1/message_types.ts";
import { PollChangeEvent as ProtoPollChangeEvent } from "../generated/photon/imessage/v1/poll_types.ts";
import {
  mapChatEvent,
  mapGroupEvent,
  mapMessageEvent,
  mapPollEvent,
} from "../mapper.ts";
import type {
  ChatEvent,
  GroupEvent,
  MessageEvent,
  PollEvent,
} from "../types/events.ts";

/**
 * Parse proto3-JSON `photon.imessage.v1.*ChangeEvent` payloads into the
 * SDK's public event types.
 *
 * Inbound events no longer stream through this client (they ride Fusor);
 * they arrive as proto3-JSON bodies inside delivery envelopes. These
 * helpers are the single source of truth for decoding them: the generated
 * codecs own the wire conventions (camelCase fields, RFC3339 timestamps →
 * `Date`, enum names, base64 bytes) and the same mappers the old streaming
 * transport used produce the public shapes — so consumers never hand-write
 * a schema for the event graph.
 *
 * `sequence` is the envelope's per-line sequence, stamped onto the event
 * exactly as the streaming plane once did.
 *
 * Returns `undefined` when the payload decodes but carries no change this
 * SDK version recognizes (e.g. a newer server's new event variant) —
 * callers should skip those, not throw. A structurally invalid payload
 * (wrong field types, malformed timestamps) throws.
 */
export function parseMessageChangeEvent(
  json: unknown,
  sequence: number
): MessageEvent | undefined {
  return mapMessageEvent(sequence, ProtoMessageChangeEvent.fromJSON(json));
}

/** See {@link parseMessageChangeEvent}. */
export function parsePollChangeEvent(
  json: unknown,
  sequence: number
): PollEvent | undefined {
  return mapPollEvent(sequence, ProtoPollChangeEvent.fromJSON(json));
}

/** See {@link parseMessageChangeEvent}. */
export function parseGroupChangeEvent(
  json: unknown,
  sequence: number
): GroupEvent | undefined {
  return mapGroupEvent(sequence, ProtoGroupChangeEvent.fromJSON(json));
}

/** See {@link parseMessageChangeEvent}. */
export function parseChatChangeEvent(
  json: unknown,
  sequence: number
): ChatEvent | undefined {
  return mapChatEvent(sequence, ProtoChatChangeEvent.fromJSON(json));
}
