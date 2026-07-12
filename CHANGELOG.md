# Changelog

## 2.0.0

One breaking release covering the fetch transport and the package split.

### Breaking

- **`createClient` is gone from the root.** Transports are explicit:
  `createHttpClient` (root or `/http`) and `createGrpcClient` (root or
  `/grpc`). v1 gRPC code migrates by changing its import specifier to
  `@photon-ai/advanced-imessage/grpc`, where `createClient` survives as a
  deprecated alias and every v1 type keeps its name.
- **gRPC dependencies are optional peers.** `nice-grpc`, `nice-grpc-common`,
  and `@grpc/grpc-js` are no longer installed with the package. HTTP users
  (including Cloudflare Workers) get a dependency-free install; gRPC users
  run `bun add nice-grpc nice-grpc-common @grpc/grpc-js`. Calling
  `createGrpcClient` without them throws a `ConnectionError` naming the
  packages.
- **Live event streams are gRPC-only.** The HTTP transport has no `events`
  resource or `subscribeEvents`/`watch`; inbound events over HTTP ride
  webhooks, parsed with `parseMessageChangeEvent` & friends.

### Added

- Fetch-based HTTP transport: the SDK runs on Cloudflare Workers, edge
  runtimes, browsers, Node, and Bun. Enforced in CI by booting in workerd.
- Subpath exports: `@photon-ai/advanced-imessage/http` and
  `@photon-ai/advanced-imessage/grpc`.
- The v1 gRPC transport, frozen at v1 behavior, behind a lazily loaded
  entrypoint that keeps `nice-grpc` out of every eagerly evaluated module
  graph.
- Live Photo companion transfer over HTTP, the `server` client option for
  dedicated instances, and safe classification for body-less HTTP errors
  (`retryAfter`, `source`).

### Internal

- The repo is now a bun-workspaces monorepo (`packages/core`, `packages/http`,
  `packages/grpc`, published `packages/advanced-imessage`). Only
  `packages/advanced-imessage` ships to npm; it bundles the rest as
  code-split ESM chunks so error classes keep one identity across
  entrypoints.
