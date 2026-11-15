import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { getCandidates } from '../controllers/candidates.controller';
import { getDemoRoster } from '../controllers/demo.controller';
import { config } from '../config';
import { requireStudent } from '../middleware/session';
import { courseParams, validate } from '../middleware/validate';

// all api routes, mounted at /api in app.ts.
// add new modules here: one line per endpoint, logic goes in a controller.
export const apiRouter = Router();

// public
apiRouter.get('/health', getHealth);

// demo only, lets the frontend pick a student until real login exists
if (config.env !== 'production') {
  apiRouter.get('/demo/roster', getDemoRoster);
}

// everything below needs a signed-in student
apiRouter.use(requireStudent);

// matching
apiRouter.get('/courses/:courseId/candidates', validate({ params: courseParams }), getCandidates);

// TODO profile + enrollment routes (see sdd api section), e.g.
// apiRouter.get('/courses/:courseId/profile', validate({ params: courseParams }), getProfile);
// apiRouter.put('/courses/:courseId/profile', validate({ params: courseParams, body: profileBody }), saveProfile);
