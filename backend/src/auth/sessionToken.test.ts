// collaborative code by somesh and claude sonnet 5.5

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { SESSION_HOURS, createToken, readCookie, readToken } from './sessionToken';

const HOUR = 60 * 60 * 1000;

describe('session token', () => {
  it('gives back the student id it was made for', () => {
    expect(readToken(createToken('101'))).toBe('101');
  });

  it('is good for 8 hours and no longer', () => {
    const start = 1_000_000;
    const token = createToken('101', start);
    expect(SESSION_HOURS).toBe(8);
    expect(readToken(token, start + 8 * HOUR - 1)).toBe('101');
    expect(readToken(token, start + 8 * HOUR)).toBeNull();
  });

  it('rejects a token with the student id changed', () => {
    const [body, signature] = createToken('101').split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, sid: '102' })).toString('base64url');
    expect(readToken(`${forged}.${signature}`)).toBeNull();
  });

  it('rejects a token with a bad signature', () => {
    const [body] = createToken('101').split('.');
    expect(readToken(`${body}.not-the-signature`)).toBeNull();
  });

  it('rejects missing, empty and garbled tokens', () => {
    expect(readToken(undefined)).toBeNull();
    expect(readToken('')).toBeNull();
    expect(readToken('nodots')).toBeNull();
    expect(readToken('a.b.c')).toBeNull();
  });

  it('rejects a correctly signed token that has no student id', () => {
    // signed with the real secret but the payload is the wrong shape
    const body = Buffer.from(JSON.stringify({ exp: Date.now() + HOUR })).toString('base64url');
    const signature = createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
    expect(readToken(`${body}.${signature}`)).toBeNull();
  });

  it('rejects a correctly signed body that is not json', () => {
    const body = Buffer.from('not json').toString('base64url');
    const signature = createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
    expect(readToken(`${body}.${signature}`)).toBeNull();
  });
});

describe('readCookie', () => {
  it('finds one cookie among several', () => {
    expect(readCookie('a=1; session=abc.def; b=2', 'session')).toBe('abc.def');
  });

  it('keeps an = sign inside the value', () => {
    expect(readCookie('session=abc==', 'session')).toBe('abc==');
  });

  it('gives undefined when the cookie is not there', () => {
    expect(readCookie(undefined, 'session')).toBeUndefined();
    expect(readCookie('a=1', 'session')).toBeUndefined();
  });
});
