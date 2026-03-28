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
import type { ScheduledMessageId } from "../types/branded.ts";
import type { ScheduleEvent } from "../types/events.ts";
import type {
  CreateScheduledMessageOptions,
  ScheduledMessage,
  UpdateScheduledMessageOptions,
} from "../types/scheduled-messages.ts";
import { unwrap } from "../utils/unwrap.ts";

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
      // Encode the payload as JSON bytes containing the send request info.
      const payloadObj = { chat: options.chat, text: options.text };
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));

      // Encode the schedule as JSON bytes.
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

  /** Update an existing scheduled message. */
  async update(
    id: ScheduledMessageId,
    options: UpdateScheduledMessageOptions
  ): Promise<ScheduledMessage> {
    try {
      // Build payload bytes from the update options, if text/chat are provided.
      const payloadObj: Record<string, unknown> = {};
      if (options.chat !== undefined) {
        payloadObj.chat = options.chat;
      }
      if (options.text !== undefined) {
        payloadObj.text = options.text;
      }
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));

      // Build schedule bytes from the update options, if schedule is provided.
      const scheduleObj = options.schedule ?? { type: "once" as const };
      const scheduleBytes = new TextEncoder().encode(
        JSON.stringify(scheduleObj)
      );

      const response = await this._client.updateScheduledMessage({
        id,
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
