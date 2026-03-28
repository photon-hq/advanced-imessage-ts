/**
 * Attachment-related domain types.
 *
 * Wraps the proto `AttachmentInfo` with branded GUIDs and SDK-friendly enums.
 */

import type { AttachmentGuid } from "./branded.js";
import type { TransferState } from "./enums.js";

// ---------------------------------------------------------------------------
// AttachmentInfo
// ---------------------------------------------------------------------------

/** Metadata about a message attachment as returned by the server. */
export interface AttachmentInfo {
  /** Escape hatch to the underlying proto message. */
  readonly _raw?: unknown;
  /** The file name (e.g. "photo.heic"). */
  readonly fileName: string;
  /** Unique attachment identifier. */
  readonly guid: AttachmentGuid;
  /** Whether the attachment has an associated Live Photo video. */
  readonly hasLivePhoto: boolean;
  /** Image height in pixels, when applicable. */
  readonly height?: number;
  /** Whether the attachment should be hidden from the conversation view. */
  readonly hideAttachment: boolean;
  /** Whether this attachment was sent by the local user. */
  readonly isOutgoing: boolean;
  /** Whether this attachment is a sticker. */
  readonly isSticker: boolean;
  /** MIME type (e.g. "image/heic"). */
  readonly mimeType: string;
  /** The original GUID before any server-side transformation. */
  readonly originalGuid?: AttachmentGuid;
  /** Total size in bytes. */
  readonly totalBytes: number;
  /** Current transfer state of the attachment. */
  readonly transferState: TransferState;
  /** Uniform Type Identifier (e.g. "public.heic"). */
  readonly uti: string;
  /** Image width in pixels, when applicable. */
  readonly width?: number;
}

// ---------------------------------------------------------------------------
// AttachmentInput
// ---------------------------------------------------------------------------

/**
 * Input for uploading an attachment -- either raw bytes or a file path.
 *
 * @example
 * ```ts
 * // From bytes
 * const input: AttachmentInput = {
 *   data: new Uint8Array([...]),
 *   fileName: "photo.png",
 *   mimeType: "image/png",
 * };
 *
 * // From a file path on the server
 * const input: AttachmentInput = { path: "/tmp/photo.png" };
 * ```
 */
export type AttachmentInput =
  | {
      readonly data: Uint8Array;
      readonly fileName: string;
      readonly mimeType: string;
    }
  | {
      readonly path: string;
      readonly fileName?: string;
      readonly mimeType?: string;
    };

// ---------------------------------------------------------------------------
// StreamedDownload
// ---------------------------------------------------------------------------

/**
 * A streaming attachment download.
 *
 * Provides both streaming and buffered consumption paths so callers can
 * choose whichever fits their use case.
 *
 * @example
 * ```ts
 * const dl = await im.attachments.download(guid);
 * console.log(`Downloading ${dl.totalBytes} bytes...`);
 *
 * // Stream
 * for await (const chunk of dl.stream) { ... }
 *
 * // Or buffer the whole thing
 * const bytes = await dl.arrayBuffer();
 * ```
 */
export interface StreamedDownload {
  /** Convenience method to buffer the entire download into a single `Uint8Array`. */
  arrayBuffer(): Promise<Uint8Array>;
  /** A web-standard `ReadableStream` of binary chunks. */
  readonly stream: ReadableStream<Uint8Array>;
  /** Total size in bytes, known upfront from the first chunk. */
  readonly totalBytes: number;
}
