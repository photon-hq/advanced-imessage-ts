/**
 * Attachment-related domain types.
 */

import type { CompanionKind, TransferState } from "./enums.js";

export interface AttachmentInfo {
  readonly companionKind?: CompanionKind;
  readonly fileName: string;
  readonly guid: string;
  readonly isHidden: boolean;
  readonly isOutgoing: boolean;
  readonly isSticker: boolean;
  readonly mimeType: string;
  readonly originalGuid?: string;
  readonly totalBytes: number;
  readonly transferState: TransferState;
  readonly uti: string;
}

export interface CompanionInfo {
  readonly fileName: string;
  readonly kind: CompanionKind;
  readonly mimeType: string;
  readonly totalBytes: number;
}

export interface UploadAttachmentResult {
  /** Primary attachment metadata. Use `attachment.guid` with `messages.sendAttachment(...)`. */
  readonly attachment: AttachmentInfo;
  /** Live Photo companion metadata when `input.companion` was provided. */
  readonly companion?: CompanionInfo;
}

export interface AttachmentInput {
  /** Optional Live Photo video bytes paired with the primary image. */
  readonly companion?: {
    /** Raw companion video bytes. */
    readonly data: Uint8Array;
  };
  /** Raw file bytes to upload. */
  readonly data: Uint8Array;
  /** Display filename stored with the attachment, including extension. */
  readonly fileName: string;
}

export type DownloadAttachmentChunk =
  | {
      /** First frame: attachment metadata and optional companion metadata. */
      readonly type: "header";
      readonly info: AttachmentInfo;
      readonly companionInfo?: CompanionInfo;
    }
  | {
      /** Byte chunk for the primary attachment. */
      readonly type: "primaryChunk";
      readonly data: Uint8Array;
    }
  | {
      /** Byte chunk for the Live Photo companion video. */
      readonly type: "companionChunk";
      readonly data: Uint8Array;
    };
