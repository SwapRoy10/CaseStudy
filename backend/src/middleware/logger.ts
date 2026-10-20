import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { config } from '../config';

// Structured logging, adapted from the template's pino-logger. Differences:
// logs go to stdout (not a file) so they show up in the `npm run dev` / demo
// terminal, and tests are silent by default.

export const logger = pino({
  level: config.logLevel,
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          // one line per request in the dev terminal; production keeps full JSON
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,req,res,responseTime' },
        }
      : undefined,
  // Never write credentials to logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});

// Express rewrites req.url inside mounted routers (/api is stripped), so log originalUrl
const fullUrl = (req: { url?: string; originalUrl?: string }) => req.originalUrl ?? req.url;

// One log line per request with a request id; attaches req.log for handlers.
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Health checks run every 10s from the frontend; don't drown the terminal
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customSuccessMessage: (req, res, ms) => `${req.method} ${fullUrl(req)} ${res.statusCode} ${Math.round(ms)}ms`,
  customErrorMessage: (req, res) => `${req.method} ${fullUrl(req)} ${res.statusCode} failed`,
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  serializers: {
    req: (req) => ({ method: req.method, url: req.originalUrl ?? req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
