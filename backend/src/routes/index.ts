import { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { getCandidates } from '../controllers/candidates.controller';
import { requireStudent } from '../middleware/session';

// All API routes, mounted at /api in app.ts.
// Add new modules here: one line per endpoint, logic goes in a controller.
export const apiRouter = Router();

// Public
apiRouter.get('/health', getHealth);

// Everything below needs a signed-in student
apiRouter.use(requireStudent);

// Matching
apiRouter.get('/courses/:courseId/candidates', getCandidates);

// TODO profile + enrollment routes (see SDD API section), e.g.
// apiRouter.get('/courses/:courseId/profile', getProfile);
// apiRouter.put('/courses/:courseId/profile', saveProfile);
