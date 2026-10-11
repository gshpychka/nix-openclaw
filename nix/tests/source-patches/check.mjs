import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-source-patch-"));
try {
  fs.mkdirSync(path.join(root, "src/plugins"), { recursive: true });
  for (const name of ["discovery.ts", "hardlink-policy.ts"]) {
    fs.writeFileSync(path.join(root, "src/plugins", name), fs.readFileSync(path.join(process.env.OPENCLAW_SOURCE, "src/plugins", name)));
  }
  const patched = spawnSync("patch", ["--batch", "--fuzz=0", "-p1", "-i", process.env.OWNERSHIP_PATCH], { cwd: root, encoding: "utf8" });
  assert.equal(patched.status, 0, patched.stdout + patched.stderr);
  let policy = fs.readFileSync(path.join(root, "src/plugins/hardlink-policy.ts"), "utf8");
  policy = policy.replace(/^import .*;\n/gm, "").replaceAll("export function", "function");
  const discovery = fs.readFileSync(path.join(root, "src/plugins/discovery.ts"), "utf8");
  const start = discovery.indexOf("function checkPathStatAndPermissions(");
  const end = discovery.indexOf("function isExtensionFile(", start);
  assert.ok(start >= 0 && end > start);
  assert.match(discovery.slice(discovery.indexOf("function createPluginScanner("), discovery.length), /checkPathStatAndPermissions\(\{\n\s+env,\n/);
  const code = stripTypeScriptTypes(policy + discovery.slice(start, end));
  let stat = { mode: 0o555, uid: 30001 };
  const realpaths = new Map();
  const context = vm.createContext({
    path, process: { platform: "linux" },
    resolveIsNixMode: (env) => env?.OPENCLAW_NIX_MODE === "1",
    pluginCacheRealpathSync: (file) => realpaths.get(file) ?? file,
    pluginCacheStatSync: () => stat,
    refreshPluginCacheStat: () => stat,
    formatPosixMode: (mode) => mode.toString(8),
    fs: { chmodSync: () => { throw new Error("fixture cannot chmod"); } },
  });
  vm.runInContext(code, context);
  const params = (rootDir, nix) => ({ rootDir, source: `${rootDir}/index.js`, origin: "config", uid: 1000, env: { OPENCLAW_NIX_MODE: nix } });
  const issue = (rootDir, nix) => context.checkPathStatAndPermissions(params(rootDir, nix))?.message;
  assert.equal(issue("/nix/store/plugin", "1"), undefined);
  assert.match(issue("/nix/store/plugin", "0"), /suspicious ownership/);
  assert.match(issue("/tmp/plugin", "1"), /suspicious ownership/);
  assert.match(issue("/nix/store-other/plugin", "1"), /suspicious ownership/);
  realpaths.set("/nix/store/escaped", "/tmp/plugin");
  assert.match(issue("/nix/store/escaped", "1"), /suspicious ownership/);
  stat = { mode: 0o777, uid: 30001 };
  assert.match(issue("/nix/store/plugin", "1"), /world-writable/);
  stat = null;
  assert.match(issue("/nix/store/plugin", "1"), /cannot stat/);
  assert.equal(context.shouldRejectHardlinkedPluginFiles(params("/nix/store/plugin", "1")), false);
  assert.equal(context.shouldRejectHardlinkedPluginFiles(params("/tmp/plugin", "1")), true);
  console.log("pinned source patch application, caller environment, ownership and path guards: PASS");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
