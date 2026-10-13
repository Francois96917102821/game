import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const tests = ["dungeon", "dungeon-integration", "gold-economy", "pvp-client",
  "tavern", "expeditions", "homestead", "soul-crafting"];
let failed = false;

for (const test of tests) {
  const profile = await mkdtemp(join(tmpdir(), "well-browser-test-"));
  const browser = spawn(process.env.CHROME_BIN || "chrome", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--disable-extensions", "--no-first-run", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  let launchError;
  browser.on("error", (error) => { launchError = error; });
  let socket;
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (launchError) throw launchError;
      try {
        port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
        break;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await delay(100);
      }
    }
    if (!port) throw new Error("Chrome did not start its debugging endpoint.");
    const url = `http://127.0.0.1:8765/tests/${test}.test.html`;
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Chrome target creation failed: ${response.status}`);
    const target = await response.json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    // Virtual time can outrun IndexedDB I/O; wait for the actual page result instead.
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Browser test timed out.")), 45000);
      socket.addEventListener("message", (event) => {
        const reply = JSON.parse(event.data);
        if (reply.id !== 1) return;
        clearTimeout(timer);
        if (reply.error || reply.result.exceptionDetails) {
          reject(new Error(JSON.stringify(reply.error || reply.result.exceptionDetails)));
        } else resolve(reply.result.result.value);
      });
      socket.send(JSON.stringify({
        id: 1, method: "Runtime.evaluate",
        params: {
          awaitPromise: true, returnByValue: true,
          expression: `new Promise(resolve => {
            const timer = setInterval(() => {
              const result = document.querySelector("[data-result]");
              if (!result) return;
              clearInterval(timer);
              resolve({ status: result.dataset.result, log: document.getElementById("log")?.textContent });
            }, 100);
          })`,
        },
      }));
    });
    console.log(`${result.status.toUpperCase()} ${test}\n${result.log || ""}`);
    if (result.status !== "pass") failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${test}: ${error.message}`);
  } finally {
    socket?.close();
    if (browser.exitCode === null && browser.pid) {
      const exited = new Promise((resolve) => browser.once("exit", resolve));
      browser.kill();
      await exited;
    }
    await rm(profile, { recursive: true, force: true });
  }
}
if (failed) process.exitCode = 1;
