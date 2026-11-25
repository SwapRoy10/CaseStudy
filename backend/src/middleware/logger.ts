import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { config } from '../config';

// pino logging adapted from the template, logs to stdout and tests are silent

export const logger = pino({
  level: config.logLevel,
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          // one line per request in dev, production keeps full json
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,req,res,responseTime' },
        }
      : undefined,
  // keep credentials out of logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-operator-key"]', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});

// express strips /api inside mounted routers, so log originalUrl
const fullUrl = (req: { url?: string; originalUrl?: string }) => req.originalUrl ?? req.url;

// one log line per request with an id, also sets req.log
export const requestLogger = pinoHttp({
  logger,
  // reuse the caller's id and send it back, so errors map to a log line
  genReqId: (req, res) => {
    const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // skip health checks, the frontend hits them every 10s
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customSuccessMessage: (req, res, ms) => `${req.method} ${fullUrl(req)} ${res.statusCode} ${Math.round(ms)}ms`,
  customErrorMessage: (req, res) => `${req.method} ${fullUrl(req)} ${res.statusCode} failed`,
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  serializers: {
    req: (req) => ({ method: req.method, url: req.originalUrl ?? req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
