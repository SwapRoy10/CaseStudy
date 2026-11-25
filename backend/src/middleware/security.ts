import rateLimit from 'express-rate-limit';
import { config } from '../config';

// adapted from the template, helmet() is applied in app.ts

// per ip limit on the api, a factory so each app and test gets its own counter
export function createApiRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.path === '/health', // the frontend polls health every 10s
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a few minutes and try again.' } },
  });
}

// stricter limit on sign in to slow guessing, only wrong attempts count
export function createSignInRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many sign in attempts. Please wait a few minutes and try again.' } },
  });
}
