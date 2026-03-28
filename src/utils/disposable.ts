/**
 * Helper for creating `AsyncDisposable` instances.
 *
 * Wraps a cleanup callback into an object that implements
 * `Symbol.asyncDispose`, so it can be used with `await using`.
 */

/**
 * Create an `AsyncDisposable` that invokes `cleanup` when disposed.
 *
 * @example
 * ```ts
 * await using resource = toAsyncDisposable(async () => {
 *   channel.close();
 * });
 * ```
 */
export function toAsyncDisposable(
  cleanup: () => Promise<void>
): AsyncDisposable {
  return {
    [Symbol.asyncDispose]: cleanup,
  };
}
