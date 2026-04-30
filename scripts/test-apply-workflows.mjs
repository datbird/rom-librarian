import { execFileSync } from "node:child_process";
import process from "node:process";

for (const script of ["scripts/test-apply-m3u-case-fixes.mjs", "scripts/test-apply-missing-m3u-playlists.mjs", "scripts/test-apply-disc-case-fixes.mjs", "scripts/test-apply-empty-folder-cleanup.mjs", "scripts/test-apply-orphaned-media-quarantine.mjs"]) {
  execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: "inherit" });
}

console.log("apply workflow tests passed");
