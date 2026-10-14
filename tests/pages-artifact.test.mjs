import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const workflow = await readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8");
const copy = workflow.match(/^\s+cp (.+) dist\/$/m);
assert.ok(copy, "Pages workflow must declare its static asset copy list");
const artifact = new Map(await Promise.all(copy[1].split(" ").map(async (name) => [
  name, await readFile(new URL(name, root), "utf8"),
])));
const sha = "artifact-regression-sha";
const substitutions = [...workflow.matchAll(/^\s+sed -i "(.+)" dist\/(\S+)$/gm)];
assert.ok(substitutions.length, "Pages workflow must version its release assets");
for (const [, command, name] of substitutions) {
  assert.ok(artifact.has(name), `${name} is not packaged`);
  let content = artifact.get(name);
  for (const substitution of command.split("; ")) {
    const match = substitution.match(/^s\|([^|]+)\|([^|]+)\|$/);
    assert.ok(match, `Unsupported manifest substitution: ${substitution}`);
    const source = match[1].replaceAll('\\"', '"');
    const target = match[2].replaceAll('\\"', '"').replaceAll("${DEPLOY_SHA}", sha);
    content = content.split("\n").map((line) => line.replace(source, target)).join("\n");
  }
  artifact.set(name, content);
}
const html = artifact.get("index.html");
for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|#)/.test(value)) continue;
  const [name, query] = value.split("?");
  assert.ok(artifact.has(name), `Missing packaged asset: ${name}`);
  if (/\.(?:js|css)$/.test(name)) assert.equal(query, `v=${sha}`, `Unversioned asset: ${name}`);
}
assert.ok(artifact.has("heart-shard-model.js"), "Heart Shard module is missing from Pages");
assert.ok(html.indexOf(`src="heart-shard-model.js?v=${sha}"`) <
  html.indexOf(`src="homestead-model.js?v=${sha}"`), "Heart Shard dependency must load first");
assert.ok(artifact.get("game.js").includes(`game-art.svg?v=${sha}`), "Game artwork is not versioned");
console.log(`PASS Pages manifest packages and versions all local assets (${fileURLToPath(root)})`);
