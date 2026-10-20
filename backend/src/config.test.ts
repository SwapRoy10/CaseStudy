import { describe, expect, it } from 'vitest';
import { parseEnv } from './config';

describe('parseEnv', () => {
  it('fills in defaults for local dev', () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:5173', 'http://localhost:4173']);
  });

  it('splits and trims CORS_ORIGIN', () => {
    const env = parseEnv({ CORS_ORIGIN: 'http://a.test, https://b.test' });
    expect(env.CORS_ORIGIN).toEqual(['http://a.test', 'https://b.test']);
  });

  it('rejects bad values with a message naming the variable', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({ CORS_ORIGIN: 'localhost:5173' })).toThrow(/CORS_ORIGIN/);
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
