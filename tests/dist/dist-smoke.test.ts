/**
 * Post-build gate for the published package. Run AFTER `bun run build`:
 *
 *   bun test tests/dist
 *
 * Asserts the three properties the split promises consumers:
 *  1. one class identity across every entrypoint (code-split shared chunks),
 *  2. the gRPC transport works from dist when the peers are installed,
 *  3. nothing statically reachable from the index/http entries imports
 *     nice-grpc — fetch-only runtimes never evaluate it.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "bun:test";

const DIST = join(
  import.meta.dir,
  "../../packages/advanced-imessage/dist"
);

// Static ESM imports/re-exports only — deliberately does NOT match dynamic
// `import(...)`, which is the lazy boundary the grpc entry relies on.
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)[^;]*?from\s*['"]([^'"]+)['"]/g;

function staticSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  for (const match of source.matchAll(STATIC_IMPORT)) {
    const specifier = match[1];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

/** Externals statically reachable from an entry file, following chunks. */
function reachableExternals(entry: string): Set<string> {
  const externals = new Set<string>();
  const queue = [join(DIST, entry)];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || visited.has(file)) {
      continue;
    }
    visited.add(file);
    for (const specifier of staticSpecifiers(file)) {
      if (specifier.startsWith(".")) {
        queue.push(join(dirname(file), specifier));
      } else {
        externals.add(specifier);
      }
    }
  }
  return externals;
}

describe("dist smoke", () => {
  it("keeps one error-class identity across all three entrypoints", async () => {
    const root = await import(join(DIST, "index.js"));
    const http = await import(join(DIST, "http.js"));
    const grpc = await import(join(DIST, "grpc.js"));
    expect(http.IMessageError).toBe(root.IMessageError);
    expect(grpc.IMessageError).toBe(root.IMessageError);
    expect(grpc.TypedEventStream).toBe(root.TypedEventStream);

    const error = new grpc.ValidationError("x", {
      code: "invalidArgument",
      context: {},
      grpcCode: 3,
      retryable: false,
    });
    expect(error instanceof root.IMessageError).toBe(true);
  });

  it("serves a working gRPC client from dist when the peers are installed", async () => {
    const grpc = await import(join(DIST, "grpc.js"));
    expect(grpc.createClient).toBe(grpc.createGrpcClient);
    const client = grpc.createGrpcClient({
      address: "localhost:59999",
      token: "t",
    });
    const stream = client.messages.subscribeEvents();
    expect(stream instanceof grpc.TypedEventStream).toBe(true);
    await stream.close();
    await client.close();
  });

  it("exposes both factories at the root, HTTP-flavored", async () => {
    const root = await import(join(DIST, "index.js"));
    expect(typeof root.createHttpClient).toBe("function");
    expect(typeof root.createGrpcClient).toBe("function");
    expect(root.createClient).toBeUndefined();
  });

  it("never statically imports nice-grpc from the index/http graphs", () => {
    for (const entry of ["index.js", "http.js"]) {
      const externals = reachableExternals(entry);
      for (const external of externals) {
        expect(external).not.toStartWith("nice-grpc");
        expect(external).not.toStartWith("@grpc/");
      }
    }
  });

  it("reaches nice-grpc only behind the grpc entry's dynamic import", () => {
    // The grpc entry's STATIC graph must be peer-free too — the peers load
    // through import() at first client creation.
    const externals = reachableExternals("grpc.js");
    for (const external of externals) {
      expect(external).not.toStartWith("nice-grpc");
      expect(external).not.toStartWith("@grpc/");
    }
  });
});
