import express from 'express';
import cors from 'cors';
import { config } from './config';
import { apiRouter } from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';

// Builds the app without starting a server, so tests can call it directly.
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
