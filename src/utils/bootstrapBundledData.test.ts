import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { syncBundledDataDirectories } from "./bootstrapBundledData";

function mkTempDir(name: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

test("syncBundledDataDirectories copies missing bundled directories into an empty data directory", () => {
  const sourceRoot = mkTempDir("toonflow-bundled-source");
  const targetRoot = mkTempDir("toonflow-runtime-data");

  fs.mkdirSync(path.join(sourceRoot, "web"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "web", "index.html"), "<html>ok</html>");
  fs.mkdirSync(path.join(sourceRoot, "skills"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "skills", "default.md"), "# default");

  const copied = syncBundledDataDirectories({
    bundledDataDir: sourceRoot,
    dataDir: targetRoot,
    directoryNames: ["web", "skills"],
  });

  assert.deepEqual(copied.sort(), ["skills", "web"]);
  assert.equal(fs.readFileSync(path.join(targetRoot, "web", "index.html"), "utf8"), "<html>ok</html>");
  assert.equal(fs.readFileSync(path.join(targetRoot, "skills", "default.md"), "utf8"), "# default");
});

test("syncBundledDataDirectories does not overwrite populated runtime directories", () => {
  const sourceRoot = mkTempDir("toonflow-bundled-source");
  const targetRoot = mkTempDir("toonflow-runtime-data");

  fs.mkdirSync(path.join(sourceRoot, "web"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "web", "index.html"), "<html>from-source</html>");

  fs.mkdirSync(path.join(targetRoot, "web"), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, "web", "index.html"), "<html>from-target</html>");

  const copied = syncBundledDataDirectories({
    bundledDataDir: sourceRoot,
    dataDir: targetRoot,
    directoryNames: ["web"],
  });

  assert.deepEqual(copied, []);
  assert.equal(fs.readFileSync(path.join(targetRoot, "web", "index.html"), "utf8"), "<html>from-target</html>");
});

test("syncBundledDataDirectories seeds empty runtime directories", () => {
  const sourceRoot = mkTempDir("toonflow-bundled-source");
  const targetRoot = mkTempDir("toonflow-runtime-data");

  fs.mkdirSync(path.join(sourceRoot, "vendor"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "vendor", "openai.ts"), "export default {};");

  fs.mkdirSync(path.join(targetRoot, "vendor"), { recursive: true });

  const copied = syncBundledDataDirectories({
    bundledDataDir: sourceRoot,
    dataDir: targetRoot,
    directoryNames: ["vendor"],
  });

  assert.deepEqual(copied, ["vendor"]);
  assert.equal(fs.readFileSync(path.join(targetRoot, "vendor", "openai.ts"), "utf8"), "export default {};");
});

test("syncBundledDataDirectories force-syncs selected directories", () => {
  const sourceRoot = mkTempDir("toonflow-bundled-source");
  const targetRoot = mkTempDir("toonflow-runtime-data");

  fs.mkdirSync(path.join(sourceRoot, "web"), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, "web", "index.html"), "<html>new-web</html>");

  fs.mkdirSync(path.join(targetRoot, "web"), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, "web", "index.html"), "<html>old-web</html>");

  const copied = syncBundledDataDirectories({
    bundledDataDir: sourceRoot,
    dataDir: targetRoot,
    directoryNames: ["web"],
    forceSyncDirectoryNames: ["web"],
  });

  assert.deepEqual(copied, ["web"]);
  assert.equal(fs.readFileSync(path.join(targetRoot, "web", "index.html"), "utf8"), "<html>new-web</html>");
});
