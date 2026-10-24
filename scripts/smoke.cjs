const { spawn } = require("node:child_process");
const { chromium } = require("D:/Developers/Projects/portfolio/node_modules/playwright-core");

const ROOT = "D:/Developers/Projects/portfolio";
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

function startServer() {
  const proc = spawn("python", ["-m", "http.server", String(PORT), "--directory", "out"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: false,
  });
  return proc;
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return true;
    } catch {}
    await wait(250);
  }
  return false;
}

async function main() {
  const server = startServer();
  let failures = 0;
  try {
    if (!(await waitForServer())) {
      console.error("server did not start");
      process.exitCode = 1;
      return;
    }

    const browser = await chromium.launch();
    // Desktop + mobile overflow + console errors
    for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: vp });
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      console.log(`viewport ${vp.width}x${vp.height}: overflow=${overflow}, consoleErrors=${errors.length}`);
      if (overflow) failures++;
      if (errors.length) { failures++; errors.forEach((e) => console.log("  -", e)); }
      await page.close();
    }

    // Reduced motion
    {
      const ctx = await browser.newContext({ reducedMotion: "reduce" });
      const page = await ctx.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      console.log(`reduced-motion: consoleErrors=${errors.length}`);
      if (errors.length) { failures++; errors.forEach((e) => console.log("  -", e)); }
      await page.close();
      await ctx.close();
    }

    // OG image
    const og = await fetch(`${BASE}/og.png`);
    console.log(`og.png: ${og.status}`);
    if (og.status !== 200) failures++;

    await browser.close();
  } finally {
    server.kill();
  }

  if (failures) {
    console.error(`smoke failed: ${failures} issue(s)`);
    process.exitCode = 1;
  } else {
    console.log("smoke passed");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
