import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    http: "src/http.ts",
    grpc: "src/grpc.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Shared chunks keep one class identity for IMessageError & friends across
  // the entrypoints, and (once the grpc entry lands) keep its transport in a
  // lazily evaluated chunk.
  splitting: true,
  treeshake: true,
  // The private workspace packages get bundled in; everything runtime-visible
  // to consumers stays external.
  noExternal: [/^@photon-ai\/aim-/],
  external: [
    "nice-grpc",
    "nice-grpc-common",
    "@grpc/grpc-js",
    "@bufbuild/protobuf",
  ],
  tsconfig: "tsconfig.json",
});
