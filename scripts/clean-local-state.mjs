import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const repoTargets = [
  path.join(rootDir, "data"),
  path.join(rootDir, "out"),
  path.join(rootDir, "release"),
];

const appDataRoot = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const userDataTargets = [
  path.join(appDataRoot, "metrion"),
  path.join(appDataRoot, "Metrion"),
];

function removeIfPresent(targetPath) {
  if (!existsSync(targetPath)) {
    return false;
  }

  rmSync(targetPath, { recursive: true, force: true });
  return true;
}

let removedCount = 0;

for (const targetPath of [...repoTargets, ...userDataTargets]) {
  const removed = removeIfPresent(targetPath);
  console.log(`${removed ? "removed" : "missing"} ${targetPath}`);
  if (removed) {
    removedCount += 1;
  }
}

console.log(`Cleanup complete. Removed ${removedCount} path(s).`);
