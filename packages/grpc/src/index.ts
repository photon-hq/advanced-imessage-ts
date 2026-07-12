// biome-ignore-all lint/performance/noBarrelFile: package root is the public gRPC entrypoint.

// Interim barrel: the lazy façade (which keeps nice-grpc out of eagerly
// evaluated module graphs) replaces this in the next stage.
export { createClient as createGrpcClientEager } from "./v1/client.ts";
