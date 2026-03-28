/**
 * Safely unwrap a value that may be `undefined` or `null`.
 *
 * Used in place of non-null assertions (`!`) to satisfy the
 * `noNonNullAssertion` lint rule while providing a clear runtime error
 * when a gRPC response field is unexpectedly missing.
 */
export function unwrap<T>(value: T | undefined | null, field: string): T {
  if (value == null) {
    throw new Error(`Expected ${field} in response`);
  }
  return value;
}
