/**
 * Address-related domain types.
 *
 * Wraps the proto `AddressInfo` with branded types and SDK-friendly enums.
 */

import type { ChatServiceType } from "./enums.js";

// ---------------------------------------------------------------------------
// AddressInfo
// ---------------------------------------------------------------------------

/** A resolved address (phone number or email) and its service metadata. */
export interface AddressInfo {
  /** The canonical address string (e.g. "+1234567890" or "user@icloud.com"). */
  readonly address: string;
  /** The original, uncanonicalized form if it differs from `address`. */
  readonly uncanonicalizedId?: string;
  /** The service this address is registered on. */
  readonly service: ChatServiceType;
  /** ISO country code, when known. */
  readonly country?: string;
  /** Escape hatch to the underlying proto message. */
  readonly _raw?: unknown;
}
