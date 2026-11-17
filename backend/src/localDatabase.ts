// the tests reseed the database and add and delete rows, so they should only
// ever run against a database on this machine (or the one CI starts). pointing
// them at the shared one would rewrite the demo data on every run.
// set ALLOW_REMOTE_DB_TESTS=true if you really mean it.
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'].includes(host);
  } catch {
    return false;
  }
}

// true when the tests are allowed to touch the database in this url
export function testsMayUseDatabase(url: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  return isLocalDatabase(url) || env.ALLOW_REMOTE_DB_TESTS === 'true';
}
