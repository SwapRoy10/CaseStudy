// collaborative code by the group and claude sonnet 5.5

import { describe, expect, it } from 'vitest';
import { isLocalDatabase, testsMayUseDatabase } from './localDatabase';

describe('isLocalDatabase', () => {
  it('accepts the docker and local urls', () => {
    expect(isLocalDatabase('postgresql://casestudy:casestudy@localhost:5432/casestudy')).toBe(true);
    expect(isLocalDatabase('postgresql://u:p@127.0.0.1:5432/db')).toBe(true);
    expect(isLocalDatabase('postgresql://u:p@[::1]:5432/db')).toBe(true);
  });

  it('rejects supabase and any other remote host', () => {
    expect(isLocalDatabase('postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres')).toBe(false);
    expect(isLocalDatabase('postgresql://u:p@db.example.com:5432/db')).toBe(false);
  });

  it('does not get fooled by localhost in the password or path', () => {
    expect(isLocalDatabase('postgresql://localhost:pw@db.example.com/localhost')).toBe(false);
  });

  it('rejects an empty or broken url', () => {
    expect(isLocalDatabase(undefined)).toBe(false);
    expect(isLocalDatabase('')).toBe(false);
    expect(isLocalDatabase('not a url')).toBe(false);
  });
});

describe('testsMayUseDatabase', () => {
  const remote = 'postgresql://u:p@db.example.com:5432/db';

  it('blocks a remote database unless it is allowed on purpose', () => {
    expect(testsMayUseDatabase(remote, {})).toBe(false);
    expect(testsMayUseDatabase(remote, { ALLOW_REMOTE_DB_TESTS: 'true' })).toBe(true);
  });

  it('allows a local one', () => {
    expect(testsMayUseDatabase('postgresql://u:p@localhost:5432/db', {})).toBe(true);
  });
});
