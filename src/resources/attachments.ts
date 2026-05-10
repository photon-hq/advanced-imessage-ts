import { fromGrpcError } from "../errors/error-handler.ts";
import { CompanionKind } from "../generated/photon/imessage/v1/attachment_types.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import type { AttachmentServiceClient } from "../transport/grpc-client.ts";
import { mapAttachmentInfo, mapCompanionInfo } from "../transport/mapper.ts";
import type {
  AttachmentInfo,
  AttachmentInput,
  DownloadAttachmentChunk,
  UploadAttachmentResult,
} from "../types/attachments.ts";
import { unwrap } from "../utils/unwrap.ts";

function mapDownloadFrame(
  frame: Awaited<
    ReturnType<AttachmentServiceClient["downloadAttachment"]>
  > extends AsyncIterable<infer T>
    ? T
    : never
): DownloadAttachmentChunk | undefined {
  if (frame.header) {
    return {
      type: "header",
      info: mapAttachmentInfo(unwrap(frame.header.attachment, "attachment")),
      companionInfo: frame.header.companion
        ? mapCompanionInfo(frame.header.companion)
        : undefined,
    };
  }

  if (frame.primaryChunk) {
    return {
      type: "primaryChunk",
      data: frame.primaryChunk,
    };
  }

  if (frame.companionChunk) {
    return {
      type: "companionChunk",
      data: frame.companionChunk,
    };
  }

  return undefined;
}

/**
 * Attachment APIs.
 *
 * - `get(attachment)` fetches file name, MIME type, size, transfer state, and
 *   other metadata for an uploaded or received attachment.
 * - `upload(input)` uploads primary file bytes and optionally a Live Photo
 *   companion video; returns the persisted attachment metadata.
 * - `downloadStream(attachment)` streams a header frame followed by primary
 *   attachment chunks and optional companion chunks.
 */
export class AttachmentsResource {
  private readonly _client: AttachmentServiceClient;

  constructor(client: AttachmentServiceClient) {
    this._client = client;
  }

  /**
   * Fetch metadata for a previously uploaded or received attachment.
   *
   * @param attachment - Attachment guid (from `attachments.upload(...)`,
   *                     `message.content.attachments[i].guid`, etc.).
   */
  async get(attachment: string): Promise<AttachmentInfo> {
    try {
      const response = await this._client.getAttachmentInfo({
        attachmentGuid: attachment,
      });
      return mapAttachmentInfo(unwrap(response.attachment, "attachment"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Upload a file (and optional Live Photo companion video) to the server.
   */
  async upload(input: AttachmentInput): Promise<UploadAttachmentResult> {
    try {
      const response = await this._client.uploadAttachment({
        fileName: input.fileName,
        data: input.data,
        companion: input.companion
          ? {
              data: input.companion.data,
              kind: CompanionKind.COMPANION_KIND_LIVE_PHOTO_VIDEO,
            }
          : undefined,
      });
      return {
        attachment: mapAttachmentInfo(
          unwrap(response.attachment, "attachment")
        ),
        companion: response.companion
          ? mapCompanionInfo(response.companion)
          : undefined,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /** Stream the bytes of an attachment as the server emits them. */
  downloadStream(
    attachment: string
  ): TypedEventStream<DownloadAttachmentChunk> {
    const abort = new AbortController();
    const rpcStream = this._client.downloadAttachment(
      {
        attachmentGuid: attachment,
      },
      { signal: abort.signal }
    );

    async function* mapFrames(): AsyncGenerator<DownloadAttachmentChunk> {
      try {
        for await (const frame of rpcStream) {
          const mapped = mapDownloadFrame(frame);
          if (mapped) {
            yield mapped;
          }
        }
      } catch (err) {
        throw fromGrpcError(err);
      }
    }

    return new TypedEventStream(mapFrames(), async () => abort.abort());
  }
}
