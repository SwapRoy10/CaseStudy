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

  it('uses safe defaults for sign in settings', () => {
    const env = parseEnv({});
    expect(env.SESSION_SECRET).toBeUndefined();
    expect(env.OPERATOR_KEY).toBeUndefined();
    expect(env.SCHOOL_EMAIL_DOMAIN).toBe('case.edu');
  });

  it('rejects a session secret or operator key that is too short', () => {
    expect(() => parseEnv({ SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv({ OPERATOR_KEY: 'short' })).toThrow(/OPERATOR_KEY/);
  });

  it('will not start in production without a session secret', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET: required in production/);
    const secret = 'x'.repeat(32);
    expect(parseEnv({ NODE_ENV: 'production', SESSION_SECRET: secret }).SESSION_SECRET).toBe(secret);
  });
});
