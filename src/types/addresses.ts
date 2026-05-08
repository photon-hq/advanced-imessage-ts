/**
 * Address-related domain types.
 */

import type { ChatServiceType } from "./enums.js";

/**
 * An address bound to one concrete transport service.
 */
export interface SingleServiceAddressInfo {
  /** Canonical email or E.164 phone number for this participant. */
  readonly address: string;
  /** ISO 3166-1 alpha-2 country code when Messages has one, else omitted. */
  readonly country?: string;
  /** The concrete service this participant record is bound to. */
  readonly service: ChatServiceType;
}

/** A canonical address paired with every service reported by the server. */
export interface MultiServiceAddressInfo {
  /** Canonical email or E.164 phone number. */
  readonly address: string;
  /** ISO 3166-1 alpha-2 country code when known, else `null`. */
  readonly country: string | null;
  /** Service set reported by the server. */
  readonly services: readonly ChatServiceType[];
}
