import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Pages is packaged by the shared tests/prepare-pages-artifact.py; verify the output of that real preparer.
const root = fileURLToPath(new URL("../", import.meta.url));
const workflow = await readFile(join(root, ".github/workflows/deploy-pages.yml"), "utf8");
assert.match(workflow, /^\s+run: python3 tests\/prepare-pages-artifact\.py\s*$/m,
  "Pages workflow must build its artifact with the shared preparer");
assert.doesNotMatch(workflow, /^\s+(?:cp|sed -i) /m, "Pages workflow must not keep a second hand-written manifest");

const sha = "artifact-regression-sha";
const work = await mkdtemp(join(tmpdir(), "well-pages-artifact-"));
try {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile()) await copyFile(join(root, entry.name), join(work, entry.name));
  }
  const env = { ...process.env, DEPLOY_SHA: sha };
  delete env.SUPABASE_URL;
  delete env.SUPABASE_ANON_KEY;
  const prepared = spawnSync(process.env.PYTHON || "python3", [join(root, "tests/prepare-pages-artifact.py")],
    { cwd: work, env, encoding: "utf8" });
  assert.equal(prepared.status, 0,
    `Pages preparer failed: ${prepared.error || ""}${prepared.stdout || ""}${prepared.stderr || ""}`);

  const dist = join(work, "dist");
  const packaged = new Set(await readdir(dist));
  const html = await readFile(join(dist, "index.html"), "utf8");
  const sourceHtml = await readFile(join(root, "index.html"), "utf8");
  for (const [, value] of sourceHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|#)/.test(value)) continue;
    assert.ok(packaged.has(value.split("?")[0]), `Source page asset is not packaged: ${value}`);
  }
  for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|#)/.test(value)) continue;
    const [name, query] = value.split("?");
    assert.ok(packaged.has(name), `Missing packaged asset: ${name}`);
    if (/\.(?:js|css)$/.test(name)) assert.equal(query, `v=${sha}`, `Unversioned asset: ${name}`);
  }
  assert.ok(packaged.has("heart-shard-model.js"), "Heart Shard module is missing from Pages");
  assert.ok(html.includes(`src="heart-shard-model.js?v=${sha}"`), "Heart Shard module is not versioned");
  assert.ok(html.indexOf(`src="heart-shard-model.js?v=${sha}"`) <
    html.indexOf(`src="homestead-model.js?v=${sha}"`), "Heart Shard dependency must load first");
  assert.ok(packaged.has("elemental-gear-model.js"), "Elemental module must be packaged");
  assert.ok(html.includes(`src="elemental-gear-model.js?v=${sha}"`), "Elemental cache version is missing");
  assert.ok(html.indexOf(`src="elemental-gear-model.js?v=${sha}"`) < html.indexOf(`src="game.js?v=${sha}"`),
    "Elemental model must load before game");
  assert.ok((await readFile(join(dist, "game.js"), "utf8")).includes(`game-art.svg?v=${sha}`),
    "Game artwork is not versioned");
  console.log(`PASS Pages preparer packages and versions all local assets (${packaged.size} files)`);
} finally {
  await rm(work, { recursive: true, force: true });
}
