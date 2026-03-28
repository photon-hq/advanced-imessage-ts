/**
 * Shared types used across multiple resource namespaces.
 */

import type { MessageGuid } from "./branded.js";

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

/** Returned after sending a message. */
export interface SendReceipt {
  readonly guid: MessageGuid;
  readonly clientMessageId?: string;
}

/** Returned after a command that operates on an existing message. */
export interface CommandReceipt {
  readonly guid: MessageGuid;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Metadata attached to a single page of results. */
export interface PaginatedPage<T> {
  readonly data: readonly T[];
  readonly meta: {
    readonly total: number;
    readonly offset: number;
    readonly limit: number;
  };
}

/**
 * A lazy, auto-paginating result set.
 *
 * - `await` it to get the first page.
 * - `for await ... of` it to iterate every item across all pages.
 * - Call `.toArray()` to buffer everything (with an optional safety limit).
 *
 * @example
 * ```ts
 * // First page only
 * const page = await im.messages.list({ chatGuid: chat, limit: 25 });
 *
 * // All items, lazily streamed
 * for await (const msg of im.messages.list({ chatGuid: chat })) {
 *   console.log(msg.text);
 * }
 *
 * // Buffered with a safety cap
 * const all = await im.messages.list({ chatGuid: chat }).toArray({ limit: 1000 });
 * ```
 */
export interface Paginated<T>
  extends AsyncIterable<T>,
    PromiseLike<PaginatedPage<T>> {
  /** Collect all items into an array, optionally capped by `limit`. */
  toArray(options?: { readonly limit?: number }): Promise<T[]>;
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

/** Options for automatic retry with exponential back-off. */
export interface RetryOptions {
  /** Maximum number of attempts (including the initial call). */
  readonly maxAttempts?: number;
  /** Initial delay in milliseconds before the first retry. */
  readonly initialDelay?: number;
  /** Maximum delay in milliseconds between retries. */
  readonly maxDelay?: number;
}
