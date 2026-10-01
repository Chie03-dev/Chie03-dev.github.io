/* ==========================================================================
   tools/pixel-test.mjs - assertions on REAL rendered pixels
   ==========================================================================
   Run it with:  node tools/pixel-test.mjs      (from the repo root)

   WHY THIS EXISTS, and why smoke.mjs cannot do it:

   smoke.mjs stubs the 2d context, and a stub records no pixels. So it is blind
   to anything that is only wrong in the OUTPUT - a shape drawn with the wrong
   outline, an animation that never advances. Both of those bugs are real ones
   that shipped in this project: every broadleaf was drawn with its crown sheared
   flat across the top, and the sun and clouds never moved at all. Mutation
   tests 21 and 22 were added to cover them and BOTH REPORTED "SMOKE PASSED",
   which is precisely the kind of false confidence this repo has been bitten by
   before. A test that cannot see a bug is worse than no test, because it is
   believed.

   So this drives a real headless Edge against the real index.html and asserts
   on real pixels, read back with getImageData inside the page.

   Two constraints worth knowing, both learned the hard way here:

     1. It MUST be served over http, not file://. ES modules are blocked by
        CORS on a file:// origin, so the page loads and every import silently
        fails - the probe then reports nothing and looks like a broken test
        rather than a broken setup.
     2. It MUST use a fresh --user-data-dir per run. Edge caches modules
        aggressively, so a re-run after an edit can silently load the OLD
        biomes.js and "confirm" that a bug is still present. Two of the
        readings during this work were that lie.

   No dependencies, no build step, nothing here is ever fetched by a browser.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import http from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Edge is what is installed on this machine; Chrome works identically. */
const BROWSERS = [
  join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
       'Microsoft\\Edge\\Application\\msedge.exe'),
  join(process.env['ProgramFiles'] || 'C:\\Program Files',
       'Microsoft\\Edge\\Application\\msedge.exe'),
  join(process.env['ProgramFiles'] || 'C:\\Program Files',
       'Google\\Chrome\\Application\\chrome.exe')
];
const browser = BROWSERS.find(p => { try { return readFileSync(p).length >= 0; }
                                      catch { return false; } });
if (!browser) {
  console.error('PIXEL TEST: no Edge or Chrome found; cannot run.');
  process.exit(2);
}

/* The verdict is emitted into the DOM and read back with --dump-dom, because a
   headless browser gives us no console to read. That is also why the verdict is
   JSON in the DOM rather than something read off a screenshot: --dump-dom is
   exact, and OCR is not. */
function buildProbe() {
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const probe = readFileSync(join(ROOT, 'tools', 'pixel-probe.html'), 'utf8');
  /* The probe supplies its own <head>/<body> and script; the page supplies
     every section the layout measures. Both are needed: without the real
     sections there is no panel, no gutters and no sky layer to assert on.

     index.html ends with `<script type="module" src="js/main.js">`, so the
     cut is made on the body tag and the main script, not on an inline module. */
  const bodyMatch = index.match(/<body[^>]*>([\s\S]*?)<script\s+type="module"\s+src=/i);
  if (!bodyMatch) {
    console.error('PIXEL TEST: could not find the page body in index.html');
    process.exit(2);
  }
  /* BOTH the head and the body are taken from the page. The first version of this
     probe injected only the body markup, so the stylesheet never loaded, every
     section measured as full-width, and gutters() returned two 8px slivers at
     the viewport edges. The art was then correctly refused to draw a sun into an
     8px gutter - the probe was measuring an unstyled page and every failure was
     an artefact of the harness, not a defect in the site. */
  const headMatch = index.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!bodyMatch || !headMatch) {
    console.error('PIXEL TEST: could not find the page head or body in index.html');
    process.exit(2);
  }
  const out = probe.replace('<!--INJECT-->', headMatch[1] + '\n' + bodyMatch[1]);
  /* Written to the REPO ROOT, not into tools/. The probe imports './js/main.js',
     and a page served from tools/ would resolve that to tools/js/main.js, which
     does not exist - every import 404s, the script throws on its first line, and
     the run reports "no verdict" with nothing to explain it. */
  writeFileSync(join(ROOT, '.pixel-run.html'), out, 'utf8');
  return '.pixel-run.html';
}
/* A static server, run in a SEPARATE PROCESS and not in this one.
   This is not a style choice. spawnSync() blocks Node's event loop for as long
   as the browser runs, so a server living in THIS process can never accept a
   connection: the browser requests the page, nothing is listening because the
   event loop that would have accepted it is blocked waiting for the browser,
   and the load hangs until the spawn times out. It presents as "the probe never
   reported a verdict", which is a miserable thing to debug.

   Node's own static file server is used rather than a dependency, so this still
   has no install step. */
function serve() {
  const script = `
    import { createServer } from 'node:http';
    import { readFileSync } from 'node:fs';
    import { join, extname } from 'node:path';
    const ROOT = ${JSON.stringify(ROOT)};
    const TYPES = { '.html':'text/html', '.js':'text/javascript',
                    '.mjs':'text/javascript', '.css':'text/css',
                    '.woff2':'font/woff2', '.png':'image/png' };
    const s = createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\\/+/, '')
                  || 'index.html';
      try {
        const b = readFileSync(join(ROOT, rel));
        /* NO-CACHE, and this is load-bearing. Each run gets a fresh browser
           profile, but a module fetched by an earlier run can still be served
           from the HTTP cache, so an edit to biomes.js produced byte-identical
           output and I spent a round concluding the fix "did not work" when it
           had simply never been loaded. A pixel test that silently tests the
           previous revision is worse than no test. */
        res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] ||
                                       'application/octet-stream',
                             'Cache-Control': 'no-store, no-cache, must-revalidate',
                             'Pragma': 'no-cache' });
        res.end(b);
      } catch { res.writeHead(404); res.end('not found'); }
    });
    /* The port arrives as an ENV VAR, not process.argv[2]: under "node -e" the
       argv positions shift, and process.argv[2] came through undefined, which
       reached listen() as NaN and threw ERR_SOCKET_BAD_PORT. No backticks in
       this comment either - they would close the template literal. */
    s.listen(Number(process.env.PIXEL_PORT), '127.0.0.1', () =>
      process.stdout.write('READY\\n'));
  `;
  const port = 8000 + (process.pid % 1000);
  const child = spawn(process.execPath, ['--input-type=module', '-e', script],
                      { stdio: ['ignore', 'pipe', 'inherit'],
                        env: { ...process.env, PIXEL_PORT: String(port) } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('static server did not start')),
                             15000);
    child.stdout.on('data', d => {
      if (String(d).includes('READY')) {
        clearTimeout(timer);
        resolve({ port, stop: () => { try { child.kill(); } catch {} } });
      }
    });
    child.on('error', reject);
  });
}

/* ==========================================================================
   Driving the browser over CDP (Chrome DevTools Protocol), not --dump-dom.

   WHY: --window-size cannot reach a phone viewport in this headless build.
   Measured on this machine, requesting a window gives:

       requested 360x740  -> viewport 492x601
       requested 480x740  -> viewport 492x601
       requested 821x1180 -> viewport 797x601

   So every width below 492px silently rendered as 492px, and the HEIGHT was
   clamped too. A "360px phone" run was really a 492px run. The phone gutter
   is never as narrow in that test as in a real phone, which is precisely the
   situation that let a 26px collar cover a 16px gutter go unnoticed.

   Emulation.setDeviceMetricsOverride has no such floor: it sets the CSS
   viewport outright, so 360x740 is genuinely 360x740.

   Each size also reports the viewport the page ACTUALLY got (vwSeen below).
   That is the real fix for the reporting lie: if the browser ever hands back a
   width other than the one requested, the run FAILS instead of quietly testing
   the wrong layout and reporting it as a phone.
   ========================================================================== */

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'pixelprof-'));
  const port = 9200 + Math.floor(Math.random() * 700);
  const proc = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: 'ignore' });

  /* The debugger takes a moment to come up; poll rather than guess a sleep. */
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    await sleep(250);
    try { await fetch('http://127.0.0.1:' + port + '/json/version'); ready = true; }
    catch { /* not listening yet */ }
  }
  if (!ready) {
    proc.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
    console.error('PIXEL TEST: the browser never opened a debugging port.');
    process.exit(2);
  }

  /* /json/new rejects GET and answers PUT with an "unsafe HTTP verb" error. */
  const tgt = await (await fetch(
    'http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' })).json();

  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(res => ws.addEventListener('open', res));

  const send = (method, params = {}, sessionId) => new Promise(res => {
    const id = ++nextId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  return {
    send,
    /* A fresh target per run, so nothing carries over between sizes: not the
       device metrics, not the emulated media, not the scroll position. */
    newTarget: async () => {
      const t = await (await fetch(
        'http://127.0.0.1:' + port + '/json/new?about:blank',
        { method: 'PUT' })).json();
      const a = await send('Target.attachToTarget',
                           { targetId: t.id, flatten: true });
      return { id: t.id, session: a.result.sessionId };
    },
    close: async () => {
      try { ws.close(); } catch {}
      proc.kill();
      await sleep(300);        /* let Edge release the profile before deleting */
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    }
  };
}

/* Poll until the probe has filled its verdict element. The probe does its own
   waiting (scroll settle, frame capture); this only bounds the total. */
async function waitForVerdict(send, S, ms = 25000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const r = await send('Runtime.evaluate', {
      expression: `(function(){
        var el = document.getElementById('probe-out');
        return el ? el.innerHTML : '';
      })()`,
      returnByValue: true
    }, S);
    const html = r.result?.result?.value || '';
    if (html.includes('@@PIXEL@@') && html.includes('@@END@@')) return html;
    await sleep(200);
  }
  return null;
}

/* One run: fresh target, real viewport, parse the verdict.
   `reduced` selects the motion mode. BOTH are run for every width, because they
   are two different contracts:
     - reduced: the sky must be STILL. That is the accessibility promise, and a
       page that keeps animating under prefers-reduced-motion is broken.
     - normal: the sky must MOVE with no scrolling. That is the bug being fixed.
   Running only one of them leaves the other entirely unverified, which is how a
   fix for "the sky does not animate" can ship while quietly breaking the people
   who asked for less motion. */
async function runOnce(bc, rel, port, width, height, reduced) {
  const url = 'http://127.0.0.1:' + port + '/' + rel;
  const { session: S } = await bc.newTarget();

  /* The line that makes the difference: a real 360x740 CSS viewport, in mobile
     mode, instead of the 492x601 that --window-size silently returned. */
  await bc.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width <= 500
  }, S);

  /* Reduced motion over CDP, so no browser flag can leak into the next run.
     Under --dump-dom this was --force-prefers-reduced-motion, which had to be
     threaded through the spawn args and was easy to get backwards. */
  await bc.send('Emulation.setEmulatedMedia', {
    features: [{
      name: 'prefers-reduced-motion',
      value: reduced ? 'reduce' : 'no-preference'
    }]
  }, S);

  await bc.send('Page.navigate', { url }, S);
  const html = await waitForVerdict(bc.send, S);

  /* Ask the page what viewport it ACTUALLY got. Trusting the request alone is
     exactly how a 492px layout came to be reported as 360px for so long. */
  const vp = await bc.send('Runtime.evaluate', {
    expression: 'innerWidth + "x" + innerHeight', returnByValue: true
  }, S);
  const vwSeen = (vp.result && vp.result.result && vp.result.result.value) || '?';

  /* Hard-fail on a mismatch rather than reporting a false pass. If the browser
     ever clamps the viewport again, the suite stops instead of quietly testing
     a layout nobody asked for and calling it a phone. */
  if (vwSeen !== width + 'x' + height) {
    console.error('PIXEL TEST: asked for ' + width + 'x' + height +
                  ' but the page reported ' + vwSeen + '.');
    console.error('  The layout under test is not the layout that was requested,');
    console.error('  so any result here would be meaningless.');
    process.exit(2);
  }
  if (!html) {
    console.error('PIXEL TEST: the probe never reported a verdict at ' + width +
                  'x' + height + (reduced ? ' (reduced)' : '') + '.');
    console.error('  a missing verdict means the page did not run, not that the');
    console.error('  assertions passed. viewport actually seen: ' + vwSeen);
    process.exit(2);
  }

  /* `html` is ALREADY scoped to the verdict element's own content (see
     waitForVerdict), so the markers are matched directly. The previous
     --dump-dom version had to re-find <div id="probe-out"> inside the whole
     document, because the template's own report() source sits OUTSIDE that div
     and could otherwise be matched by accident. Reading the element directly
     removes that class of ambiguity rather than working around it. */
  const found = (html.match(/@@PIXEL@@([\s\S]*?)@@END@@/) || [])[1];
  if (!found) {
    console.error('PIXEL TEST: the verdict element is empty.');
    console.error('  the page ran but the probe wrote nothing - that is a probe');
    console.error('  error, not a passing result.');
    process.exit(2);
  }
  const verdict = JSON.parse(
    found.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
         .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'"));
  if (verdict.error) {
    console.error('PIXEL TEST: the probe reported an error.');
    console.error('  ' + verdict.error);
    process.exit(2);
  }
  return verdict;
}

/* Heights are back to ordinary values now that the probe scrolls to the sky and
   waits for the scroll to settle (see pixel-probe.html). The WIDTHS are what
   matter for responsiveness and they are the real breakpoints.

   320 is here because it is the narrowest layout in real use (iPhone SE, small
   Androids) and the one where the gutter gets tightest. It could not be tested
   at all before: --window-size clamped every request below 492px, so "360" was
   really 492 and 320 was unreachable. With setDeviceMetricsOverride these are
   now genuine phone layouts. */
const WIDTHS = [[1440, 900], [821, 1180], [390, 844], [320, 568]];
let anyFailed = 0, skyRuns = 0;
const rel = buildProbe();
const srv = await serve();
/* One browser for the whole suite. Each size still gets its own target, own
   device metrics and own emulated media, so there is no cross-run state. */
const bc = await launch();
const MODES = [[false, 'motion on '], [true, 'reduced ']];
try {
  for (const [w, h] of WIDTHS) {
    for (const [reduced, label] of MODES) {
      const v = await runOnce(bc, rel, srv.port, w, h, reduced);
      const skipped = v.results.filter(r => r.skip);
      const ran = v.results.filter(r => !r.skip).length;
      /* Count a size as having exercised the sky only if the sky assertions
         actually ran, i.e. no "sky is on screen" skip was recorded. */
      if (!reduced && !skipped.some(r => /sky is on screen/.test(r.name))) skyRuns++;
      console.log('');
      console.log(w + 'x' + h + ' ' + label + ' ' + ran + ' assertions run, ' +
                  skipped.length + ' skipped, ' + v.failed + ' failed');
      for (const r of v.results) {
        if (/reduced-motion mode is what/.test(r.name)) continue;
        console.log('   ' + (r.skip ? 'skip' : (r.pass ? 'ok  ' : 'FAIL')) + '  ' +
                    r.name + (r.detail ? '   (' + r.detail + ')' : ''));
      }
      anyFailed += v.failed;
    }
  }
} finally {
  await bc.close();
  srv.stop();
  try { rmSync(join(ROOT, '.pixel-run.html'), { force: true }); }
  catch {}
}
/* If no size ever showed the sky, the animation assertions did not run at all.
   That must not read as success: it is the same class of false pass this whole
   tool exists to end. */
if (!skyRuns) {
  console.log('');
  console.log('PIXEL TEST FAILED: the sky was never on screen at any size tested,');
  console.log('  so none of the animation assertions actually ran.');
  process.exit(1);
}
console.log('');
if (anyFailed) {
  console.log('PIXEL TEST FAILED: ' + anyFailed + ' assertion(s) failed');
  process.exit(1);
}
console.log('PIXEL TEST PASSED: crowns are rounded and the sky animates');
console.log('  measured from real rendered pixels at ' + WIDTHS.length + ' widths');
console.log('  including at least one where the sun and clouds are visible');

