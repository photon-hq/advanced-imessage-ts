import { expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const source = join(root, "packages/advanced-imessage");
const allowedPath =
  /^package\/(dist\/|proto\/|package\.json$|README\.md$|LICENSE$)/;

it("packs only the public package at both versions without changing workspace manifests", () => {
  const temporary = mkdtempSync(join(tmpdir(), "advanced-imessage-pack-test-"));
  const manifests = [
    "package.json",
    ...["advanced-imessage", "core", "http", "grpc"].map(
      (name) => `packages/${name}/package.json`
    ),
  ];
  const originals = manifests.map((path) => ({
    path,
    content: readFileSync(join(root, path), "utf8"),
  }));
  const manifest: { exports: Record<string, { types: string }> } = JSON.parse(
    readFileSync(join(source, "package.json"), "utf8")
  );
  try {
    for (const channel of ["staging", "production"]) {
      const suffix = channel === "staging" ? "-staging.123456789.1" : "";
      const directory = join(temporary, channel);
      const destination = join(directory, "packed");
      execFileSync(process.execPath, ["scripts/pack.ts"], {
        cwd: root,
        env: {
          ...process.env,
          RELEASE_CHANNEL: channel,
          RELEASE_VERSION: "2.4.1",
          RELEASE_SUFFIX: suffix,
          PACK_DESTINATION: destination,
        },
        stdio: "pipe",
      });
      const files = readdirSync(destination);
      expect(files).toEqual([`photon-ai-advanced-imessage-2.4.1${suffix}.tgz`]);
      const archive = join(destination, files[0] ?? "");
      execFileSync("tar", ["-xzf", archive, "-C", directory]);
      const entries = execFileSync("tar", ["-tzf", archive], {
        encoding: "utf8",
      })
        .trim()
        .split("\n");
      expect(entries.every((path) => allowedPath.test(path))).toBe(true);
      for (const { types } of Object.values(manifest.exports)) {
        expect(entries).toContain(`package/${types.slice(2)}`);
      }
      expect(entries.some((path) => path.startsWith("package/proto/"))).toBe(
        true
      );
      expect(
        JSON.parse(
          readFileSync(join(directory, "package/package.json"), "utf8")
        )
      ).toEqual({
        ...manifest,
        version: `2.4.1${suffix}`,
      });
      for (const path of entries.filter(
        (path) => path !== "package/package.json"
      )) {
        expect(readFileSync(join(directory, path))).toEqual(
          readFileSync(join(source, path.slice(8)))
        );
      }
      mkdirSync(join(directory, "node_modules/@photon-ai"), {
        recursive: true,
      });
      mkdirSync(join(directory, "node_modules/@bufbuild"), { recursive: true });
      symlinkSync(
        join(directory, "package"),
        join(directory, "node_modules/@photon-ai/advanced-imessage")
      );
      symlinkSync(
        join(root, "node_modules/@bufbuild/protobuf"),
        join(directory, "node_modules/@bufbuild/protobuf")
      );
      execFileSync(
        process.execPath,
        [
          "--eval",
          `
        import assert from "node:assert/strict";
        import * as root from "@photon-ai/advanced-imessage";
        import * as http from "@photon-ai/advanced-imessage/http";
        import * as grpc from "@photon-ai/advanced-imessage/grpc";
        assert.equal(root.IMessageError, http.IMessageError);
        assert.equal(root.IMessageError, grpc.IMessageError);
        assert.equal(typeof root.createHttpClient, "function");
        assert.equal(typeof root.createGrpcClient, "function");
      `,
        ],
        { cwd: directory, stdio: "pipe" }
      );
    }
    for (const { path, content } of originals) {
      expect(readFileSync(join(root, path), "utf8")).toBe(content);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 30_000);

it.each([
  { channel: "staging", condition: "types", suffix: "-staging.123456789.1" },
  { channel: "staging", condition: "default", suffix: "-staging.123456789.1" },
  { channel: "production", condition: "types", suffix: "" },
  { channel: "production", condition: "default", suffix: "" },
])("rejects a missing $condition export target for $channel", ({
  channel,
  condition,
  suffix,
}) => {
  const fixture = mkdtempSync(
    join(tmpdir(), "advanced-imessage-missing-export-")
  );
  const fixtureSource = join(fixture, "packages/advanced-imessage");
  const manifest = JSON.parse(
    readFileSync(join(source, "package.json"), "utf8")
  );
  const target: string = manifest.exports["./grpc"][condition];
  try {
    mkdirSync(join(fixture, "scripts"), { recursive: true });
    mkdirSync(fixtureSource, { recursive: true });
    cpSync(join(root, "scripts/pack.ts"), join(fixture, "scripts/pack.ts"));
    for (const path of [
      ...manifest.files,
      "README.md",
      "LICENSE",
      "package.json",
    ]) {
      cpSync(join(source, path), join(fixtureSource, path), {
        recursive: true,
      });
    }
    rmSync(join(fixtureSource, target));
    const result = spawnSync(process.execPath, ["scripts/pack.ts"], {
      cwd: fixture,
      encoding: "utf8",
      env: {
        ...process.env,
        RELEASE_CHANNEL: channel,
        RELEASE_VERSION: "2.4.1",
        RELEASE_SUFFIX: suffix,
        PACK_DESTINATION: join(fixture, "packed"),
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `The packed archive is missing export target: ${target}`
    );
    expect(readFileSync(join(fixtureSource, "package.json"), "utf8")).toBe(
      readFileSync(join(source, "package.json"), "utf8")
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

it.each([
  { RELEASE_VERSION: "" },
  { RELEASE_VERSION: "2.4.1-rc.1" },
  { RELEASE_CHANNEL: "staging", RELEASE_SUFFIX: "" },
  { RELEASE_CHANNEL: "staging", RELEASE_SUFFIX: "-staging.01.1" },
  { RELEASE_CHANNEL: "production", RELEASE_SUFFIX: "-staging.123.1" },
  { RELEASE_CHANNEL: "unknown" },
  { PACK_DESTINATION: "" },
])("rejects invalid pack inputs: %j", (invalid) => {
  const result = spawnSync(process.execPath, ["scripts/pack.ts"], {
    cwd: root,
    env: {
      ...process.env,
      RELEASE_CHANNEL: "production",
      RELEASE_VERSION: "2.4.1",
      RELEASE_SUFFIX: "",
      PACK_DESTINATION: ".scratch/invalid-pack",
      ...invalid,
    },
    stdio: "pipe",
  });
  expect(result.status).not.toBe(0);
});
