/**
 * AttachmentsResource -- manages attachment metadata retrieval, uploading,
 * downloading (including streaming downloads with transparent iCloud recovery),
 * and Live Photo extraction.
 */

import { fromGrpcError } from "../errors/error-handler.ts";
import type { AttachmentServiceClient } from "../transport/grpc-client.ts";
import { mapAttachmentInfo } from "../transport/mapper.ts";
import type {
  AttachmentInfo,
  AttachmentInput,
  LivePhotoInput,
  StreamedDownload,
} from "../types/attachments.ts";
import type { AttachmentGuid } from "../types/branded.ts";
import { unwrap } from "../utils/unwrap.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect binary chunks from a gRPC server-streaming download RPC into a
 * `StreamedDownload` object with both streaming and buffered consumption
 * paths.
 */
function createStreamedDownload(
  rpcStream: AsyncIterable<{
    data: Uint8Array;
    totalBytes: number;
    offset: number;
  }>
): StreamedDownload {
  // We use a two-phase approach: the first chunk tells us totalBytes, then
  // we pipe everything (including the first chunk) through a ReadableStream.

  let totalBytesResolved = 0;
  let totalBytesResolve: ((bytes: number) => void) | undefined;
  new Promise<number>((resolve) => {
    totalBytesResolve = resolve;
  });

  // Collect all chunks for the buffered path.
  const allChunks: Uint8Array[] = [];

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let first = true;
        for await (const chunk of rpcStream) {
          if (first) {
            totalBytesResolved = chunk.totalBytes;
            totalBytesResolve?.(chunk.totalBytes);
            first = true;
          }
          allChunks.push(chunk.data);
          controller.enqueue(chunk.data);
          first = false;
        }
        // If the stream was empty, resolve with 0.
        if (totalBytesResolve) {
          totalBytesResolve(0);
        }
        controller.close();
      } catch (err) {
        // Resolve totalBytes promise so consumers don't hang.
        totalBytesResolve?.(0);
        controller.error(fromGrpcError(err));
      }
    },
  });

  // We need totalBytes synchronously for the result object, but it's only
  // known after the first chunk. We eagerly start the stream and expose it.
  // The `arrayBuffer()` helper reads the stream to completion.

  // We use a "lazy" approach: create the download object with a getter that
  // initializes once the first chunk arrives. Since ReadableStream starts
  // pulling immediately via `start()`, `totalBytesPromise` will resolve
  // quickly.

  // However, to keep the interface sync (totalBytes is not a promise on
  // StreamedDownload), we start at 0 and update it. The caller should
  // `await` the download call before accessing `totalBytes`.

  const download: StreamedDownload = {
    get totalBytes() {
      return totalBytesResolved;
    },
    stream: readable,
    async arrayBuffer(): Promise<Uint8Array> {
      // Drain the stream if not already consumed.
      const reader = readable.getReader();
      const chunks: Uint8Array[] = [];
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Concatenate all chunks.
      let totalLength = 0;
      for (const chunk of chunks) {
        totalLength += chunk.length;
      }
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    },
  };

  return download;
}

// ---------------------------------------------------------------------------
// AttachmentsResource
// ---------------------------------------------------------------------------

export class AttachmentsResource {
  private readonly _client: AttachmentServiceClient;

  constructor(client: AttachmentServiceClient) {
    this._client = client;
  }

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  /**
   * Retrieve metadata for a single attachment by GUID.
   */
  async get(guid: AttachmentGuid): Promise<AttachmentInfo> {
    try {
      const response = await this._client.getAttachment({ guid });
      return mapAttachmentInfo(unwrap(response.attachment, "attachment"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Get the total number of attachments known to the server.
   */
  async count(): Promise<number> {
    try {
      const response = await this._client.getAttachmentCount({});
      return response.count;
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  /**
   * Upload a Live Photo (paired image + video) in a single atomic request.
   *
   * The server writes the video as a `.mov` companion file next to the
   * image, so `getLivePhoto()` and `hasLivePhoto` work automatically.
   * Returns the image attachment with `hasLivePhoto: true`.
   */
  async uploadLivePhoto(input: LivePhotoInput): Promise<AttachmentInfo> {
    try {
      const response = await this._client.upload({
        fileName: input.image.fileName,
        mimeType: input.image.mimeType,
        data: input.image.data,
        livePhotoVideo: input.video.data,
      });

      return mapAttachmentInfo(unwrap(response.attachment, "attachment"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  /**
   * Upload an attachment to the server.
   *
   * Accepts either raw bytes with metadata or a server-side file path.
   */
  async upload(input: AttachmentInput): Promise<AttachmentInfo> {
    try {
      let fileName: string;
      let mimeType: string;
      let data: Uint8Array;

      if ("data" in input) {
        fileName = input.fileName;
        mimeType = input.mimeType;
        data = input.data;
      } else {
        // Path-based upload: the server reads from this path, but the
        // proto requires bytes. We send the path as the fileName and
        // let the server handle it. The data field carries the path
        // encoded as UTF-8 as a convention.
        fileName = input.fileName ?? input.path;
        mimeType = input.mimeType ?? "application/octet-stream";
        data = new TextEncoder().encode(input.path);
      }

      const response = await this._client.upload({
        fileName,
        mimeType,
        data,
      });

      return mapAttachmentInfo(unwrap(response.attachment, "attachment"));
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  // -------------------------------------------------------------------------
  // Download
  // -------------------------------------------------------------------------

  /**
   * Download an attachment as a streaming download.
   *
   * The returned `StreamedDownload` provides both a `ReadableStream` for
   * streaming consumption and an `arrayBuffer()` method for buffered use.
   *
   * If the attachment has been purged from local storage (iCloud-optimized),
   * the server transparently recovers it from iCloud before streaming --
   * no separate force-download step is needed.
   */
  download(guid: AttachmentGuid): StreamedDownload {
    const rpcStream = this._client.download({ attachmentGuid: guid });
    return createStreamedDownload(rpcStream);
  }

  /**
   * Download an attachment and buffer the entire result into a `Uint8Array`.
   *
   * Convenience wrapper around `download()` for callers who just want the
   * bytes.
   */
  async downloadBuffer(guid: AttachmentGuid): Promise<Uint8Array> {
    const dl = this.download(guid);
    return await dl.arrayBuffer();
  }

  /**
   * Download the Live Photo video component of an attachment.
   *
   * Returns a streaming download of the video data associated with a Live
   * Photo attachment.
   */
  getLivePhoto(guid: AttachmentGuid): StreamedDownload {
    const rpcStream = this._client.getLivePhoto({
      attachmentGuid: guid,
    });
    return createStreamedDownload(rpcStream);
  }
}
