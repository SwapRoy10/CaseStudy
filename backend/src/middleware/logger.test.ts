// collaborative code by the group and claude sonnet 5.5

import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { requestLogger } from './logger';

const output = vi.hoisted(() => ({ write: vi.fn<(line: string) => void>() }));

vi.mock('pino', async (importOriginal) => {
  const pino = await importOriginal<typeof import('pino')>();
  return {
    ...pino,
    default: (options: import('pino').LoggerOptions) => pino.default({ ...options, level: 'info' }, output),
  };
});

it('logs the full mounted URL and response status without credentials', async () => {
  const app = express();
  const api = express.Router();
  app.use('/api', api);
  api.use(requestLogger);
  api.get('/probe', (_req, res) => res.sendStatus(202));

  await request(app).get('/api/probe').set('Authorization', 'Bearer private-test-token').expect(202);

  expect(output.write).toHaveBeenCalledTimes(1);
  const line = output.write.mock.calls[0][0];
  expect(JSON.parse(line)).toMatchObject({
    req: { method: 'GET', url: '/api/probe' },
    res: { statusCode: 202 },
  });
  expect(line).not.toContain('private-test-token');
});
