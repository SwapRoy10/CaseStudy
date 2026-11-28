// collaborative code by somesh and claude sonnet 5.5

// tests reseed and delete rows, so only a local db is safe
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'].includes(host);
  } catch {
    return false;
  }
}

// ALLOW_REMOTE_DB_TESTS=true overrides the local check
export function testsMayUseDatabase(url: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  return isLocalDatabase(url) || env.ALLOW_REMOTE_DB_TESTS === 'true';
}
