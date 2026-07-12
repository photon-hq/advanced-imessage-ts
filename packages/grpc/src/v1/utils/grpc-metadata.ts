interface MetadataLike {
  get?: (key: string) => unknown;
  getAll?: (key: string) => unknown[];
  getMap?: () => Record<string, unknown>;
  toJSON?: () => Record<string, unknown>;
  [Symbol.iterator]?: () => IterableIterator<[string, unknown[]]>;
}

function getMetadata(error: unknown): MetadataLike | undefined {
  return (error as { metadata?: MetadataLike }).metadata;
}

function toStringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(toStringValues);
  }

  return typeof value === "string" ? [value] : [];
}

function* iterateMetadataEntries(
  metadata: MetadataLike
): Iterable<[string, string[]]> {
  const iterator = metadata[Symbol.iterator];
  if (typeof iterator === "function") {
    for (const entry of iterator.call(metadata)) {
      if (!Array.isArray(entry) || entry.length < 2) {
        continue;
      }

      const [key, value] = entry as [unknown, unknown];
      if (typeof key !== "string") {
        continue;
      }

      yield [key, toStringValues(value)];
    }
    return;
  }

  if (typeof metadata.toJSON === "function") {
    for (const [key, value] of Object.entries(metadata.toJSON())) {
      yield [key, toStringValues(value)];
    }
    return;
  }

  if (typeof metadata.getMap === "function") {
    for (const [key, value] of Object.entries(metadata.getMap())) {
      yield [key, toStringValues(value)];
    }
  }
}

export function readMetadataValues(error: unknown, key: string): string[] {
  const metadata = getMetadata(error);
  if (!metadata) {
    return [];
  }

  if (typeof metadata.getAll === "function") {
    return toStringValues(metadata.getAll(key));
  }

  if (typeof metadata.get === "function") {
    return toStringValues(metadata.get(key));
  }

  return [];
}

/**
 * Read the first string value from gRPC trailing metadata attached to an
 * error. Supports both `nice-grpc-common` metadata and raw `@grpc/grpc-js`
 * metadata.
 */
export function readMetadataValue(
  error: unknown,
  key: string
): string | undefined {
  return readMetadataValues(error, key)[0];
}

/**
 * Read all string metadata entries whose keys start with `prefix`, returning
 * the suffix as the record key.
 */
export function readMetadataPrefixedEntries(
  error: unknown,
  prefix: string
): Record<string, string> {
  const metadata = getMetadata(error);
  if (!metadata) {
    return {};
  }

  const entries: Record<string, string> = {};

  for (const [key, values] of iterateMetadataEntries(metadata)) {
    if (!key.startsWith(prefix) || values.length === 0) {
      continue;
    }

    const suffix = key.slice(prefix.length);
    if (suffix.length === 0) {
      continue;
    }

    const firstValue = values[0];
    if (firstValue === undefined) {
      continue;
    }
    entries[suffix] = firstValue;
  }

  return entries;
}
