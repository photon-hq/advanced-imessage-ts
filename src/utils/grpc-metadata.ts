/**
 * Read a string value from gRPC trailing metadata attached to an error.
 *
 * nice-grpc-common's `ClientError` does not expose metadata directly, so we
 * also accept a raw `@grpc/grpc-js` status object (which carries a `metadata`
 * field with a `.get()` method).
 */
export function readMetadataValue(
  error: unknown,
  key: string
): string | undefined {
  const meta = (error as { metadata?: { get(key: string): unknown[] } })
    .metadata;

  if (!meta || typeof meta.get !== "function") {
    return undefined;
  }

  const values = meta.get(key);

  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const first = values[0];
  return typeof first === "string" ? first : undefined;
}
