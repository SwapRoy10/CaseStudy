import express, { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { getCandidates } from '../controllers/candidates.controller';
import { getDemoRoster } from '../controllers/demo.controller';
import { demoSignIn, demoSignInBody } from '../controllers/demoSession.controller';
import { changePassword, getCurrentStudent, passwordBody } from '../controllers/me.controller';
import { importRosterFile, rosterQuery } from '../controllers/roster.controller';
import { signIn, signInBody, signOut } from '../controllers/session.controller';
import { config } from '../config';
import { requireOperator } from '../middleware/operator';
import { requireClientHeader, requireStudent } from '../middleware/session';
import { courseParams, validate } from '../middleware/validate';

// all api routes, mounted at /api in app.ts.
// add new modules here: one line per endpoint, logic goes in a controller.
export const apiRouter = Router();

// public
apiRouter.get('/health', getHealth);

// demo only, lets the frontend pick a student until everyone has their own login
if (config.env !== 'production') {
  apiRouter.get('/demo/roster', getDemoRoster);
}

// the team operator, with their own key instead of a student session. the key
// is checked before the file is read. canvas exports are text/csv, and excel on
// windows sometimes labels a csv application/vnd.ms-excel, so both are accepted.
apiRouter.post(
  '/operator/courses/:courseId/roster',
  requireOperator,
  express.text({ type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'], limit: '1mb' }),
  validate({ params: courseParams, query: rosterQuery }),
  importRosterFile
);

// everything below uses the session cookie, so a change has to carry the
// client header that other sites can't add
apiRouter.use(requireClientHeader);

apiRouter.post('/session', validate({ body: signInBody }), signIn);
apiRouter.delete('/session', signOut);

// demo only, signs you in as the student picked from the roster above
if (config.env !== 'production') {
  apiRouter.post('/demo/session', validate({ body: demoSignInBody }), demoSignIn);
}

// everything below needs a signed-in student
apiRouter.use(requireStudent);

apiRouter.get('/me', getCurrentStudent);
apiRouter.put('/me/password', validate({ body: passwordBody }), changePassword);

// matching
apiRouter.get('/courses/:courseId/candidates', validate({ params: courseParams }), getCandidates);

// TODO profile routes (see sdd api section), e.g.
// apiRouter.get('/courses/:courseId/profile', validate({ params: courseParams }), getProfile);
// apiRouter.put('/courses/:courseId/profile', validate({ params: courseParams, body: profileBody }), saveProfile);
