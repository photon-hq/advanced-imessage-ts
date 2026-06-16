/**
 * Helpers for reading gRPC trailing metadata.
 *
 * Connect surfaces trailing metadata as a standard `Headers` object on
 * `ConnectError.metadata`. Header names are matched case-insensitively and
 * normalised to lowercase by the `Headers` implementation, so callers should
 * pass lowercase keys/prefixes.
 */

/** Read the first string value for `key`, or `undefined` when absent. */
export function readMetadataValue(
  metadata: Headers,
  key: string
): string | undefined {
  return metadata.get(key) ?? undefined;
}

/**
 * Read all metadata entries whose keys start with `prefix`, returning the
 * suffix as the record key.
 */
export function readMetadataPrefixedEntries(
  metadata: Headers,
  prefix: string
): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const [key, value] of metadata) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const suffix = key.slice(prefix.length);
    if (suffix.length > 0) {
      entries[suffix] = value;
    }
  }

  return entries;
}
