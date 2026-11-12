import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const {
  RELEASE_CHANNEL: channel,
  RELEASE_VERSION: base,
  RELEASE_SUFFIX: suffix,
  PACK_DESTINATION: output,
} = process.env;

if (!(base && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(base))) {
  throw new Error("RELEASE_VERSION must be a stable X.Y.Z version");
}
if (
  !(
    (channel === "staging" &&
      /^-staging\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(suffix ?? "")) ||
    (channel === "production" && suffix === "")
  )
) {
  throw new Error(
    "RELEASE_CHANNEL and RELEASE_SUFFIX must describe staging or production"
  );
}
if (!output) {
  throw new Error("PACK_DESTINATION is required");
}

const root = fileURLToPath(
  new URL("../packages/advanced-imessage/", import.meta.url)
);
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (manifest.name !== "@photon-ai/advanced-imessage" || manifest.private) {
  throw new Error(
    "Only the public @photon-ai/advanced-imessage package may be packed"
  );
}
const destination = resolve(output);
const version = `${base}${suffix}`;
const temporary = mkdtempSync(join(tmpdir(), "advanced-imessage-pack-"));

try {
  for (const path of [...manifest.files, "README.md", "LICENSE"] as string[]) {
    cpSync(join(root, path), join(temporary, path), { recursive: true });
  }
  writeFileSync(
    join(temporary, "package.json"),
    `${JSON.stringify({ ...manifest, version }, null, 2)}\n`
  );
  mkdirSync(destination, { recursive: true });
  execFileSync(
    "npm",
    ["pack", "--ignore-scripts", "--pack-destination", destination],
    { cwd: temporary, stdio: "inherit" }
  );
  const members = new Set(
    execFileSync(
      "tar",
      ["-tzf", join(destination, `photon-ai-advanced-imessage-${version}.tgz`)],
      {
        encoding: "utf8",
      }
    )
      .trim()
      .split("\n")
  );
  for (const entry of Object.values<Record<string, string>>(manifest.exports)) {
    for (const target of Object.values(entry)) {
      if (!members.has(`package/${target.slice(2)}`)) {
        throw new Error(
          `The packed archive is missing export target: ${target}`
        );
      }
    }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
