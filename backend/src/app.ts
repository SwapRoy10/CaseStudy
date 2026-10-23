import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { apiRouter } from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { createApiRateLimiter } from './middleware/security';

// Builds the app without starting a server, so tests can call it directly.
// Middleware order follows the template: logging first so every request is
// covered, then security, then body parsing, routes, and error handling last.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(helmet()); // standard security headers (no sniffing, no framing, etc.)
  app.use(cors({ origin: config.corsOrigins })); // only our own frontend, not any site
  app.use(express.json({ limit: '100kb' })); // profiles are small; cap bodies so a huge one can't tie up the server

  // Rate limit only the API. Unknown paths fall through to notFound below.
  app.use('/api', createApiRateLimiter(), apiRouter);

  // Order matters: nothing matched -> 404, then every error from anywhere above
  // ends up in errorHandler, so the client always gets the same error shape.
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
