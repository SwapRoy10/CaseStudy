// original code by swap, written by hand

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { apiRouter } from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { createApiRateLimiter, createSignInRateLimiter } from './middleware/security';

// builds the app without listening, so tests can call it directly
export function createApp() {
  const app = express();
  app.disable('x-powered-by'); // don't advertise express
  app.set('trust proxy', config.trustProxy); // real client ip behind a proxy

  app.use(requestLogger); // first, so every request gets logged
  app.use(helmet()); // standard security headers
  app.use(cors({ origin: config.corsOrigins })); // only our own frontend
  app.use(express.json({ limit: '100kb' })); // profiles are small, cap the body size

  // sign in gets a tighter limit, checked before the general one
  app.post('/api/session', createSignInRateLimiter());

  app.use('/api', createApiRateLimiter(), apiRouter); // unknown paths fall through to notFound

  // order matters, these two stay last so every error has the same shape
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
