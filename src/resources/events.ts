import { fromGrpcError } from "../errors/error-handler.ts";
import { ValidationError } from "../errors/imessage-error.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { EventServiceClient } from "../transport/grpc-client.ts";
import {
  mapChatEvent,
  mapGroupEvent,
  mapMessageEvent,
  mapPollEvent,
} from "../transport/mapper.ts";
import type { CatchUpEvent } from "../types/events.ts";

function normalizeSequenceCursor(
  cursor: number | undefined,
  field: string
): number | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw new ValidationError(`${field} must be a non-negative safe integer.`, {
      code: "invalidArgument",
      context: { field, value: String(cursor) },
      grpcCode: 3,
      retryable: false,
    });
  }

  return cursor;
}

function mapCatchUpFrame(frame: {
  complete?: { headSequence: number };
  sequence?: number;
  messageChanged?: Parameters<typeof mapMessageEvent>[1];
  chatChanged?: Parameters<typeof mapChatEvent>[1];
  groupChanged?: Parameters<typeof mapGroupEvent>[1];
  pollChanged?: Parameters<typeof mapPollEvent>[1];
}): CatchUpEvent | undefined {
  if (frame.complete) {
    return {
      type: "catchup.complete",
      headSequence: frame.complete.headSequence,
    };
  }

  if (frame.sequence === undefined) {
    return undefined;
  }

  if (frame.messageChanged) {
    return mapMessageEvent(frame.sequence, frame.messageChanged);
  }

  if (frame.chatChanged) {
    return mapChatEvent(frame.sequence, frame.chatChanged);
  }

  if (frame.groupChanged) {
    return mapGroupEvent(frame.sequence, frame.groupChanged);
  }

  if (frame.pollChanged) {
    return mapPollEvent(frame.sequence, frame.pollChanged);
  }

  return undefined;
}

/**
 * Durable event-log APIs.
 *
 * - `catchUp(since)` replays durable message, chat, group, and poll events
 *   after the last fully handled sequence, then emits `catchup.complete`.
 *
 * Use this after a disconnect before reopening live `subscribeEvents` streams;
 * persist each handled event's `sequence` as the next `since` value.
 */
export class EventsResource {
  private readonly _client: EventServiceClient;

  constructor(client: EventServiceClient) {
    this._client = client;
  }

  /**
   * Replay durable events after `since`, then end with `catchup.complete`.
   *
   * Pass the last fully processed sequence to recover missed events after a
   * disconnect. Omit `since` to replay from the beginning of the retained log.
   */
  catchUp(since?: number): TypedEventStream<CatchUpEvent> {
    const afterSequence = normalizeSequenceCursor(since, "since");
    const abort = new AbortController();
    const rpcStream = this._client.catchUpEvents(
      { afterSequence },
      { signal: abort.signal }
    );

    async function* mapEvents(): AsyncGenerator<CatchUpEvent> {
      try {
        for await (const frame of rpcStream) {
          const mapped = mapCatchUpFrame(frame);
          if (mapped) {
            yield mapped;
          }
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream(mapEvents(), async () => abort.abort());
  }
}
