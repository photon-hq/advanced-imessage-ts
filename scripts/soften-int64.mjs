#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "packages/core/src/generated";

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

const THROWING_BODY = `function longToNumber(int64: { toString(): string }): number {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}`;

const SOFTENED_BODY = `function longToNumber(int64: { toString(): string }): number {
  return globalThis.Number(int64.toString());
}`;

const files = walk(ROOT);
let patched = 0;
let alreadySoft = 0;

for (const file of files) {
  const contents = readFileSync(file, "utf8");
  if (contents.includes(THROWING_BODY)) {
    writeFileSync(file, contents.replace(THROWING_BODY, SOFTENED_BODY));
    patched++;
  } else if (contents.includes("function longToNumber")) {
    alreadySoft++;
  }
}

if (patched === 0 && alreadySoft === 0) {
  throw new Error(
    "soften-int64: found no longToNumber helper under " +
      ROOT +
      " — ts-proto's emitted shape may have changed; update THROWING_BODY."
  );
}

console.log(
  `soften-int64: patched ${patched} file(s), ${alreadySoft} already softened`
);
