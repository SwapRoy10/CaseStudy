#!/usr/bin/env node
// integration smoke test. it talks to the frontend server, so a pass proves the
// page is served and /api requests reach the backend through the proxy.
//
//   node scripts/smoke.mjs                         # dev servers (npm run dev)
//   node scripts/smoke.mjs http://localhost:4173   # demo build (npm run demo)
//
// waits up to 60s for the servers to come up, then exits 0 (pass) or 1 (fail).

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

// signs in like the browser does and keeps the session cookie for later calls
const DEMO_PASSWORD = 'casestudy123';
async function signIn(email, password = DEMO_PASSWORD) {
  const res = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CaseStudy' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { res, cookie };
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
  ['wrong password gets 401 and no cookie', async () => {
    const { res, cookie } = await signIn('axr101@case.edu', 'not the password');
    assert(res.status === 401, `status ${res.status}`);
    assert(!cookie, 'a cookie was set for a failed sign in');
  }],
  ['signing in gives a session for /api/me', async () => {
    const { res, cookie } = await signIn('axr101@case.edu');
    assert(res.status === 200 && cookie, `sign in status ${res.status}`);
    const me = await fetch(`${base}/api/me`, { headers: { Cookie: cookie } });
    const body = await me.json();
    assert(me.status === 200 && body.studentId === '101', `status ${me.status}`);
  }],
  ['the demo roster signs you in as a picked student', async () => {
    const roster = await (await fetch(`${base}/api/demo/roster`)).json();
    const student = roster.courses.find((c) => c.code === 'CSDS 393').students[0];
    const res = await fetch(`${base}/api/demo/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CaseStudy' },
      body: JSON.stringify({ studentId: student.id }),
    });
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    assert(res.status === 200 && cookie, `status ${res.status}`);
    const me = await (await fetch(`${base}/api/me`, { headers: { Cookie: cookie } })).json();
    assert(me.studentId === student.id, `signed in as ${me.studentId}`);
  }],
  ['candidates for a signed-in student', async () => {
    const { cookie } = await signIn('axr101@case.edu');
    const res = await fetch(`${base}/api/courses/1/candidates`, { headers: { Cookie: cookie } });
    const body = await res.json();
    assert(res.status === 200, `status ${res.status}`);
    assert(Array.isArray(body.candidates) && body.candidates.length > 0, 'expected at least one candidate');
  }],
  ['request routes answer for a signed-in student', async () => {
    const { cookie } = await signIn('axr101@case.edu');
    const res = await fetch(`${base}/api/courses/1/requests`, { headers: { Cookie: cookie } });
    const body = await res.json();
    assert(res.status === 200 && Array.isArray(body.requests), `status ${res.status}`);
  }],
  ['the course list has every course this term, and one you are not on is 409', async () => {
    const { cookie } = await signIn('axr101@case.edu');
    const list = await (await fetch(`${base}/api/courses`, { headers: { Cookie: cookie } })).json();
    assert(list.courses?.some((c) => c.courseId === '2'), 'course 2 is missing from the list');
    const res = await fetch(`${base}/api/courses/2/profile`, { headers: { Cookie: cookie } });
    const body = await res.json();
    assert(res.status === 409 && body.error?.reason === 'NOT_ENROLLED', `status ${res.status}`);
  }],
  ['incomplete profile gets 409 NO_PROFILE', async () => {
    const { cookie } = await signIn('gxl107@case.edu');
    const res = await fetch(`${base}/api/courses/1/candidates`, { headers: { Cookie: cookie } });
    const body = await res.json();
    assert(res.status === 409 && body.error?.reason === 'NO_PROFILE', `status ${res.status}`);
  }],
  ['no session gets 401', async () => {
    const res = await fetch(`${base}/api/courses/1/candidates`);
    assert(res.status === 401, `status ${res.status}`);
  }],
  ['the old X-Student-Id header no longer counts', async () => {
    const res = await fetch(`${base}/api/courses/1/candidates`, { headers: { 'X-Student-Id': '101' } });
    assert(res.status === 401, `status ${res.status}`);
  }],
];

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

try {
  await waitForServer();
} catch (err) {
  console.error(`fail: ${err.message}`);
  process.exit(1);
}

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok: ${name}`);
  } catch (err) {
    failed++;
    console.log(`fail: ${name}: ${err.message}`);
  }
}
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${checks.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
