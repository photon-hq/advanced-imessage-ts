/**
 * ScheduledMessagesResource -- create, manage, and stream scheduled messages.
 *
 * Wraps the gRPC ScheduledMessageService to provide high-level methods for
 * creating, updating, deleting, executing, and subscribing to scheduled
 * message lifecycle events.
 */

import { fromGrpcError } from "../errors/error-handler.ts";
import type { ScheduledMessageEvent } from "../generated/photon/imessage/v1/scheduled_message_service.ts";
import { ScheduledMessageType as ProtoScheduledMessageType } from "../generated/photon/imessage/v1/scheduled_message_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { ScheduledMessageServiceClient } from "../transport/grpc-client.ts";
import { mapScheduledMessage } from "../transport/mapper.ts";
import type { ChatGuid, ScheduledMessageId } from "../types/branded.ts";
import { chatGuid } from "../types/branded.ts";
import type { ScheduleEvent } from "../types/events.ts";
import type {
  CreateScheduledMessageOptions,
  ScheduledMessage,
  ScheduledMessagePayload,
  UpdateScheduledMessageOptions,
} from "../types/scheduled-messages.ts";
import { unwrap } from "../utils/unwrap.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encode a `ScheduledMessagePayload` to the JSON bytes the server expects.
 *
 * Field names are mapped from SDK conventions to the server's
 * `ScheduledPayloadDTO` schema (e.g. `chat` → `chatGuid`,
 * `text` → `message`).
 */
function encodePayload(payload: ScheduledMessagePayload): Uint8Array {
  const obj: Record<string, unknown> = {
    chatGuid: payload.chat,
    projectId: payload.projectId,
  };
  if (payload.text !== undefined) {
    obj.message = payload.text;
  }
  if (payload.service !== undefined) {
    obj.service = payload.service;
  }
  if (payload.subject !== undefined) {
    obj.subject = payload.subject;
  }
  if (payload.effectId !== undefined) {
    obj.effectId = payload.effectId;
  }
  if (payload.clientMessageId !== undefined) {
    obj.clientMessageId = payload.clientMessageId;
  }
  if (payload.attachmentPath !== undefined) {
    obj.attachmentPath = payload.attachmentPath;
  }
  if (payload.attachmentName !== undefined) {
    obj.attachmentName = payload.attachmentName;
  }
  return new TextEncoder().encode(JSON.stringify(obj));
}

/**
 * Decode server payload bytes back into SDK field names.
 *
 * Used by `update()` to merge existing payload with user-provided changes.
 */
function decodePayload(bytes: Uint8Array): ScheduledMessagePayload {
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  return {
    chat: chatGuid(obj.chatGuid ?? ""),
    projectId: obj.projectId ?? "",
    text: obj.message,
    service: obj.service,
    subject: obj.subject,
    effectId: obj.effectId,
    clientMessageId: obj.clientMessageId,
    attachmentPath: obj.attachmentPath,
    attachmentName: obj.attachmentName,
  };
}

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

export class ScheduledMessagesResource {
  private readonly _client: ScheduledMessageServiceClient;

  constructor(client: ScheduledMessageServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /** Schedule a new message for future delivery. */
  async create(
    options: CreateScheduledMessageOptions
  ): Promise<ScheduledMessage> {
    try {
      const payloadBytes = encodePayload(options);

      const scheduleObj = options.schedule ?? { type: "once" as const };
      const scheduleBytes = new TextEncoder().encode(
        JSON.stringify(scheduleObj)
      );

      const response = await this._client.createScheduledMessage({
        type: ProtoScheduledMessageType.SCHEDULED_MESSAGE_TYPE_SEND_MESSAGE,
        payload: payloadBytes,
        scheduledFor: options.scheduledFor,
        schedule: scheduleBytes,
      });

      return mapScheduledMessage(
        unwrap(response.scheduledMessage, "scheduledMessage")
      );
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Get a scheduled message by its ID. */
  async get(id: ScheduledMessageId): Promise<ScheduledMessage> {
    try {
      const response = await this._client.getScheduledMessage({ id });
      return mapScheduledMessage(
        unwrap(response.scheduledMessage, "scheduledMessage")
      );
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** List all scheduled messages. */
  async list(): Promise<ScheduledMessage[]> {
    try {
      const response = await this._client.listScheduledMessages({});
      return response.messages.map(mapScheduledMessage);
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /**
   * Update an existing scheduled message.
   *
   * The server requires a complete payload on every update. This method
   * automatically fetches the current message, merges your changes into
   * its existing payload, and sends the full replacement.
   */
  async update(
    id: ScheduledMessageId,
    options: UpdateScheduledMessageOptions
  ): Promise<ScheduledMessage> {
    try {
      // Fetch current message to use as base for merge.
      const current = await this.get(id);
      const existing = decodePayload(current.payload);

      // Merge: user-provided values override existing ones.
      const merged: ScheduledMessagePayload = {
        chat: (options.chat as ChatGuid) ?? existing.chat,
        projectId: options.projectId ?? existing.projectId,
        text: options.text === undefined ? existing.text : options.text,
        service:
          options.service === undefined ? existing.service : options.service,
        subject:
          options.subject === undefined ? existing.subject : options.subject,
        effectId:
          options.effectId === undefined ? existing.effectId : options.effectId,
        clientMessageId:
          options.clientMessageId === undefined
            ? existing.clientMessageId
            : options.clientMessageId,
        attachmentPath:
          options.attachmentPath === undefined
            ? existing.attachmentPath
            : options.attachmentPath,
        attachmentName:
          options.attachmentName === undefined
            ? existing.attachmentName
            : options.attachmentName,
      };

      const payloadBytes = encodePayload(merged);

      // Use updated schedule if provided, otherwise preserve existing.
      const scheduleBytes = options.schedule
        ? new TextEncoder().encode(JSON.stringify(options.schedule))
        : current.schedule;

      const response = await this._client.updateScheduledMessage({
        id,
        type: ProtoScheduledMessageType.SCHEDULED_MESSAGE_TYPE_SEND_MESSAGE,
        payload: payloadBytes,
        scheduledFor: options.scheduledFor ?? current.scheduledFor,
        schedule: scheduleBytes,
      });

      return mapScheduledMessage(
        unwrap(response.scheduledMessage, "scheduledMessage")
      );
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Delete a scheduled message by its ID. */
  async delete(id: ScheduledMessageId): Promise<void> {
    try {
      await this._client.deleteScheduledMessage({ id });
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Delete all scheduled messages. */
  async deleteAll(): Promise<void> {
    try {
      await this._client.deleteAllScheduledMessages({});
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /** Immediately execute a specific scheduled message. */
  async execute(id: ScheduledMessageId): Promise<ScheduledMessage> {
    try {
      const response = await this._client.executeScheduledMessage({ id });
      return mapScheduledMessage(
        unwrap(response.scheduledMessage, "scheduledMessage")
      );
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  /** Execute all scheduled messages that are due. */
  async executeDue(): Promise<ScheduledMessage[]> {
    try {
      const response = await this._client.executeDueScheduledMessages({});
      return response.messages.map(mapScheduledMessage);
    } catch (error) {
      throw fromGrpcError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  /** Subscribe to scheduled message lifecycle events. Returns a typed event stream. */
  subscribe(): TypedEventStream<ScheduleEvent> {
    const rpcStream = this._client.subscribeScheduleEvents({});

    async function* mapEvents(): AsyncGenerator<ScheduleEvent> {
      try {
        for await (const proto of rpcStream) {
          const timestamp = proto.timestamp ?? new Date();

          if (proto.scheduledMessageChanged === undefined) {
            continue;
          }

          const evt: ScheduledMessageEvent = proto.scheduledMessageChanged;
          if (!evt.scheduledMessage) {
            continue;
          }

          yield {
            type: "schedule.changed" as const,
            scheduledMessage: mapScheduledMessage(evt.scheduledMessage),
            action: mapScheduleAction(evt.action),
            timestamp,
          };
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream<ScheduleEvent>(mapEvents());
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a proto schedule action string to the SDK ScheduleEvent action literal.
 */
function mapScheduleAction(
  action: string
): "created" | "updated" | "deleted" | "sent" | "failed" {
  switch (action) {
    case "created":
      return "created";
    case "updated":
      return "updated";
    case "deleted":
      return "deleted";
    case "sent":
      return "sent";
    case "failed":
      return "failed";
    default:
      return "created";
  }
}
