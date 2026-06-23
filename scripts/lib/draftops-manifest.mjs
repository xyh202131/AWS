import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const rootDir = process.cwd();
export const manifestPath = resolve(rootDir, "src", "config", "draftops-manifest.json");

export const draftOpsManifest = JSON.parse(readFileSync(manifestPath, "utf8"));

export const resolveManifestPath = (manifestValue, fallback) => resolve(rootDir, manifestValue || fallback);
