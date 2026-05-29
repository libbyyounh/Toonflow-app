import fs from "node:fs";
import path from "node:path";

type SyncBundledDataOptions = {
  bundledDataDir: string;
  dataDir: string;
  directoryNames: string[];
  forceSyncDirectoryNames?: string[];
};

function hasFiles(dirPath: string) {
  return fs.existsSync(dirPath) && fs.readdirSync(dirPath).length > 0;
}

function copyDirectoryContents(sourceDir: string, targetDir: string) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    fs.cpSync(path.join(sourceDir, entry), path.join(targetDir, entry), {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  }
}

function replaceDirectoryContents(sourceDir: string, targetDir: string) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  copyDirectoryContents(sourceDir, targetDir);
}

export function syncBundledDataDirectories({
  bundledDataDir,
  dataDir,
  directoryNames,
  forceSyncDirectoryNames = [],
}: SyncBundledDataOptions): string[] {
  if (!bundledDataDir || !fs.existsSync(bundledDataDir)) return [];

  const copied: string[] = [];
  const forceSyncSet = new Set(forceSyncDirectoryNames);

  for (const directoryName of directoryNames) {
    const sourceDir = path.join(bundledDataDir, directoryName);
    const targetDir = path.join(dataDir, directoryName);

    if (!fs.existsSync(sourceDir)) continue;

    if (forceSyncSet.has(directoryName)) {
      replaceDirectoryContents(sourceDir, targetDir);
      copied.push(directoryName);
      continue;
    }

    if (hasFiles(targetDir)) continue;

    copyDirectoryContents(sourceDir, targetDir);
    copied.push(directoryName);
  }

  return copied;
}

export function bootstrapBundledData(dataDir: string): string[] {
  const bundledDataDir = process.env.TOONFLOW_BUNDLED_DATA_DIR;
  if (!bundledDataDir) return [];
  const forceSyncDirectoryNames = (process.env.TOONFLOW_FORCE_SYNC_DIRS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return syncBundledDataDirectories({
    bundledDataDir,
    dataDir,
    directoryNames: ["modelPrompt", "models", "skills", "vendor", "web"],
    forceSyncDirectoryNames,
  });
}
