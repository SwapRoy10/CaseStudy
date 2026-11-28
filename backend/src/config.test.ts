// collaborative code by somesh and claude sonnet 5.5
// some parts are original code by swap, written by hand

import { describe, expect, it, vi } from 'vitest';
import { parseEnv } from './config';

it('logs an invalid startup setting and exits with status 1', async () => {
  const failure = new Error('startup exited');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw failure; });
  vi.stubEnv('PORT', 'invalid');
  vi.resetModules();
  try {
    await expect(import('./config.js')).rejects.toBe(failure);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/Invalid backend environment[\s\S]*PORT/));
    expect(exit).toHaveBeenCalledWith(1);
  } finally {
    exit.mockRestore();
    log.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

describe('parseEnv', () => {
  it('fills in defaults for local dev', () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:5173', 'http://localhost:4173']);
  });

  it('trusts no proxy unless told to', () => {
    expect(parseEnv({}).TRUST_PROXY).toBe(0);
    expect(parseEnv({ TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    expect(() => parseEnv({ TRUST_PROXY: '-1' })).toThrow(/TRUST_PROXY/);
    expect(() => parseEnv({ TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
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

  it('has the demo routes on outside production and off in it', () => {
    expect(parseEnv({}).DEMO_ROUTES).toBeUndefined();
    expect(parseEnv({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) }).DEMO_ROUTES).toBeUndefined();
  });

  it('only accepts true or false for DEMO_ROUTES', () => {
    expect(() => parseEnv({ DEMO_ROUTES: 'yes' })).toThrow(/DEMO_ROUTES/);
  });

  it('will not start in production with the demo routes on', () => {
    const env = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) };
    expect(() => parseEnv({ ...env, DEMO_ROUTES: 'true' })).toThrow(/DEMO_ROUTES: can not be true in production/);
    expect(parseEnv({ ...env, DEMO_ROUTES: 'false' }).DEMO_ROUTES).toBe('false');
  });
});
