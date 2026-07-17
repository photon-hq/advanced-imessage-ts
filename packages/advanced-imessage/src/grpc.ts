// biome-ignore-all lint/performance/noBarrelFile: subpath entrypoint for the legacy gRPC transport.

/**
 * The legacy gRPC transport — v1's full surface, including `events` and the
 * live `subscribeEvents`/`watch` streams. Requires the optional peer
 * dependencies `nice-grpc`, `nice-grpc-common`, and `@grpc/grpc-js`.
 *
 * v1 migration: change `"@photon-ai/advanced-imessage"` imports to
 * `"@photon-ai/advanced-imessage/grpc"` — `createClient` and every v1 type
 * keep their names here.
 */

export * from "@photon-ai/aim-grpc";
