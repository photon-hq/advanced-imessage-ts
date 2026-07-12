/** Group photo bytes and MIME type returned by `groups.getIcon`. */
export interface GroupIcon {
  readonly data: Uint8Array;
  readonly mimeType: string;
}
