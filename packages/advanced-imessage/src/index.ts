// biome-ignore-all lint/performance/noBarrelFile: package root is the public SDK entrypoint.

/**
 * Root entrypoint: the shared public surface plus every transport factory.
 *
 * The root is HTTP-flavored — `ClientOptions`, `AdvancedIMessage`, and the
 * resource interfaces are the HTTP client's. The gRPC transport's own
 * (v1-shaped) types live on the `./grpc` subpath.
 */

export * from "@photon-ai/aim-http";
