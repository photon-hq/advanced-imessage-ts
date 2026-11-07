import { expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const source = join(root, "packages/advanced-imessage");

it("packs a staging version without changing the source manifest", () => {
  const temporary = mkdtempSync(join(tmpdir(), "advanced-imessage-pack-test-"));
  const original = readFileSync(join(source, "package.json"), "utf8");
  try {
    const destination = join(temporary, "packed");
    execFileSync(process.execPath, ["scripts/pack.ts"], {
      cwd: root,
      env: {
        ...process.env,
        RELEASE_CHANNEL: "staging",
        RELEASE_VERSION: "2.4.1",
        RELEASE_SUFFIX: "-staging.123456789.1",
        PACK_DESTINATION: destination,
      },
      stdio: "pipe",
    });
    const archive = join(
      destination,
      "photon-ai-advanced-imessage-2.4.1-staging.123456789.1.tgz"
    );
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOzf", archive, "package/package.json"], {
        encoding: "utf8",
      })
    );
    expect(manifest.name).toBe("@photon-ai/advanced-imessage");
    expect(manifest.version).toBe("2.4.1-staging.123456789.1");
    expect(readFileSync(join(source, "package.json"), "utf8")).toBe(original);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 30_000);

it("rejects an archive missing a declaration export target", () => {
  const fixture = mkdtempSync(
    join(tmpdir(), "advanced-imessage-missing-export-")
  );
  const fixtureSource = join(fixture, "packages/advanced-imessage");
  const manifest = JSON.parse(
    readFileSync(join(source, "package.json"), "utf8")
  );
  const target: string = manifest.exports["./grpc"].types;
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
        RELEASE_CHANNEL: "staging",
        RELEASE_VERSION: "2.4.1",
        RELEASE_SUFFIX: "-staging.123456789.1",
        PACK_DESTINATION: join(fixture, "packed"),
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `The packed archive is missing export target: ${target}`
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
