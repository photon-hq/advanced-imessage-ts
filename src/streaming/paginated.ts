/**
 * Stripe-style auto-paginating list implementation.
 *
 * The `createPaginated` factory returns a {@link Paginated} object that is
 * both `PromiseLike` (so `await` fetches the first page) and `AsyncIterable`
 * (so `for await` lazily streams every item across all pages).
 */

import type { Paginated, PaginatedPage } from "../types/common.ts";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PaginatedOptions {
  /** Number of items to fetch per page. Default `25`. */
  readonly limit?: number;
  /** Starting offset for the first page. Default `0`. */
  readonly offset?: number;
}

// ---------------------------------------------------------------------------
// Page fetcher signature
// ---------------------------------------------------------------------------

/**
 * A function that fetches a single page of results at the given
 * `offset` / `limit` position.
 */
export type PageFetcher<T> = (
  offset: number,
  limit: number,
) => Promise<{ data: T[]; meta: { total: number; offset: number; limit: number } }>;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

class PaginatedImpl<T> implements Paginated<T> {
  private readonly _fetchPage: PageFetcher<T>;
  private readonly _limit: number;
  private readonly _offset: number;

  constructor(fetchPage: PageFetcher<T>, options: PaginatedOptions) {
    this._fetchPage = fetchPage;
    this._limit = options.limit ?? 25;
    this._offset = options.offset ?? 0;
  }

  // -------------------------------------------------------------------------
  // PromiseLike -- `await paginated` fetches the first page
  // -------------------------------------------------------------------------

  then<TResult1 = PaginatedPage<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: PaginatedPage<T>) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this._fetchFirstPage().then(onfulfilled, onrejected);
  }

  // -------------------------------------------------------------------------
  // AsyncIterable -- `for await` streams every item across all pages
  // -------------------------------------------------------------------------

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this._iterateAll();
  }

  // -------------------------------------------------------------------------
  // toArray -- buffer everything with an optional safety cap
  // -------------------------------------------------------------------------

  async toArray(options?: { readonly limit?: number }): Promise<T[]> {
    const cap = options?.limit ?? Infinity;
    const items: T[] = [];

    for await (const item of this) {
      items.push(item);
      if (items.length >= cap) break;
    }

    return items;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async _fetchFirstPage(): Promise<PaginatedPage<T>> {
    const result = await this._fetchPage(this._offset, this._limit);
    return {
      data: result.data,
      meta: result.meta,
    };
  }

  private async *_iterateAll(): AsyncGenerator<T> {
    let offset = this._offset;
    const limit = this._limit;

    for (;;) {
      const page = await this._fetchPage(offset, limit);

      for (const item of page.data) {
        yield item;
      }

      // If this page returned fewer items than requested, or we have
      // reached / exceeded the total, there are no more pages.
      const nextOffset = page.meta.offset + page.data.length;
      if (page.data.length < limit || nextOffset >= page.meta.total) {
        break;
      }

      offset = nextOffset;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a {@link Paginated} result set backed by the given page fetcher.
 *
 * @param fetchPage - Async function that retrieves a single page at the
 *   given `offset` and `limit`.
 * @param options   - Initial pagination options (limit, offset).
 *
 * @example
 * ```ts
 * const messages = createPaginated(
 *   (offset, limit) => rpc.listMessages({ offset, limit }),
 *   { limit: 50 },
 * );
 *
 * // First page
 * const page = await messages;
 *
 * // All items
 * for await (const msg of messages) { ... }
 *
 * // Buffered
 * const all = await messages.toArray({ limit: 1000 });
 * ```
 */
export function createPaginated<T>(
  fetchPage: PageFetcher<T>,
  options?: PaginatedOptions,
): Paginated<T> {
  return new PaginatedImpl<T>(fetchPage, options ?? {});
}
