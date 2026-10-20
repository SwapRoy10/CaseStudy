import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Adapted from the template's security middleware. helmet() is applied in app.ts.

// Per-IP limit on the API. The response uses our standard error shape.
// The frontend polls /api/health every 10s, so health checks are exempt.
// A factory, not a shared instance, so each app (and each test) gets its own counter.
export function createApiRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a few minutes and try again.' } },
  });
}

// TODO (when login exists): add a much stricter limiter on the login route, e.g.
// rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), like the template's authRateLimiter.
