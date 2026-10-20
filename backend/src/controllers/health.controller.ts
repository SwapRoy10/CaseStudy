import type { Request, Response } from 'express';

// Used by the frontend's connection indicator and the smoke test.
export function getHealth(_req: Request, res: Response) {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
}
