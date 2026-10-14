import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(".");
const workflow = (await readFile(join(root, ".github", "workflows", "deploy-pages.yml"), "utf8"))
  .replaceAll("\r\n", "\n");
function stepScript(name) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  assert.notEqual(start, -1, `Missing workflow step: ${name}`);
  const end = workflow.indexOf("      - name:", start + 1);
  const step = workflow.slice(start, end < 0 ? undefined : end);
  const runStart = step.indexOf("        run: |\n");
  assert.notEqual(runStart, -1, `Missing run script: ${name}`);
  return step.slice(runStart + "        run: |\n".length)
    .split("\n").filter((line) => line.startsWith("          "))
    .map((line) => line.slice(10)).join("\n");
}

const prepare = stepScript("Prepare static game files");
const refresh = stepScript("Refresh cached assets for this release");
const assets = prepare.match(/^\s*cp (.+) dist\/$/m)?.[1].split(/\s+/);
assert(assets?.includes("elemental-gear-model.js"), "Elemental module must be packaged");
const directory = await mkdtemp(join(tmpdir(), "well-pages-artifact-"));
const sha = "artifact-regression-sha";
try {
  await Promise.all(assets.map((asset) => copyFile(join(root, asset), join(directory, asset))));
  execFileSync(process.env.BASH_BIN || "bash", ["-c", `set -eu\n${prepare}\n${refresh}`], {
    cwd: directory, env: { ...process.env, DEPLOY_SHA: sha }, stdio: "pipe",
  });
  const html = await readFile(join(directory, "dist", "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert(scripts.includes(`elemental-gear-model.js?v=${sha}`), "Elemental cache version is missing");
  for (const script of scripts.filter((url) => !/^https?:/.test(url))) {
    assert.equal(script.split("?")[1], `v=${sha}`, `Unversioned script: ${script}`);
    assert((await stat(join(directory, "dist", script.split("?")[0]))).isFile(),
      `Artifact is missing ${script}`);
  }
  assert(scripts.indexOf(`elemental-gear-model.js?v=${sha}`) < scripts.indexOf(`game.js?v=${sha}`),
    "Elemental model must load before game");
  console.log("PASS Pages artifact copies and versions every local script, including elemental model");
} finally {
  await rm(directory, { recursive: true, force: true });
}
