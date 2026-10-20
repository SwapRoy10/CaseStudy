#!/usr/bin/env node
// Integration smoke test: talks to the FRONTEND server, so a pass proves the
// page is served AND /api requests reach the backend through the proxy.
//
//   node scripts/smoke.mjs                         # dev servers (npm run dev)
//   node scripts/smoke.mjs http://localhost:4173   # demo build (npm run demo)
//
// Waits up to 60s for the servers to come up, then exits 0 (pass) or 1 (fail).

const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const deadline = Date.now() + 60_000;

async function waitForServer() {
  for (;;) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`nothing answered at ${base}/api/health after 60s`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const checks = [
  ['frontend serves the app', async () => {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert(res.ok && html.includes('id="root"'), `GET / returned ${res.status}`);
  }],
  ['backend health via proxy', async () => {
    const body = await (await fetch(`${base}/api/health`)).json();
    assert(body.status === 'ok', `unexpected body ${JSON.stringify(body)}`);
  }],
  ['candidates for a signed-in student', async () => {
    const res = await fetch(`${base}/api/courses/1/candidates`, { headers: { 'X-Student-Id': '101' } });
    const body = await res.json();
    assert(res.status === 200, `status ${res.status}`);
    assert(Array.isArray(body.candidates) && body.candidates.length > 0, 'expected at least one candidate');
  }],
  ['incomplete profile gets 409 NO_PROFILE', async () => {
    const res = await fetch(`${base}/api/courses/1/candidates`, { headers: { 'X-Student-Id': '107' } });
    const body = await res.json();
    assert(res.status === 409 && body.error?.reason === 'NO_PROFILE', `status ${res.status}`);
  }],
  ['no session gets 401', async () => {
    const res = await fetch(`${base}/api/courses/1/candidates`);
    assert(res.status === 401, `status ${res.status}`);
  }],
];

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

try {
  await waitForServer();
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`✗ ${name}: ${err.message}`);
  }
}
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${checks.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
