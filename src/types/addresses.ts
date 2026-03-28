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
  /** Escape hatch to the underlying proto message. */
  readonly _raw?: unknown;
  /** The canonical address string (e.g. "+1234567890" or "user@icloud.com"). */
  readonly address: string;
  /** ISO country code, when known. */
  readonly country?: string;
  /** The service this address is registered on. */
  readonly service: ChatServiceType;
  /** The original, uncanonicalized form if it differs from `address`. */
  readonly uncanonicalizedId?: string;
}
