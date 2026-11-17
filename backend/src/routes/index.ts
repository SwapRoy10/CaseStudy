import express, { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { getCandidates } from '../controllers/candidates.controller';
import { getDemoRoster } from '../controllers/demo.controller';
import { demoSignIn, demoSignInBody } from '../controllers/demoSession.controller';
import { changePassword, completeTutorial, getCurrentStudent, passwordBody } from '../controllers/me.controller';
import { getProfile, putProfile } from '../controllers/profile.controller';
import * as requestsController from '../controllers/requests.controller';
import { groupParams, postReview } from '../controllers/reviews.controller';
import { importRosterFile, rosterQuery } from '../controllers/roster.controller';
import { signIn, signInBody, signOut } from '../controllers/session.controller';
import { config } from '../config';
import { requireDatabase } from '../middleware/database';
import { requireOperator } from '../middleware/operator';
import { requireClientHeader, requireStudent } from '../middleware/session';
import { courseParams, validate } from '../middleware/validate';

// all api routes, mounted at /api in app.ts.
// add new modules here: one line per endpoint, logic goes in a controller.
export const apiRouter = Router();

// public
apiRouter.get('/health', getHealth);

// demo only, lets the frontend pick a student until everyone has their own login
if (config.demoRoutes) {
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
if (config.demoRoutes) {
  apiRouter.post('/demo/session', validate({ body: demoSignInBody }), demoSignIn);
}

// everything below needs a signed-in student
apiRouter.use(requireStudent);

apiRouter.get('/me', getCurrentStudent);
apiRouter.put('/me/password', validate({ body: passwordBody }), changePassword);
apiRouter.post('/me/tutorial-complete', completeTutorial);

// profile (sdd 6.3.2, 6.3.3)
apiRouter.get('/courses/:courseId/profile', requireDatabase, validate({ params: courseParams }), getProfile);
apiRouter.put('/courses/:courseId/profile', requireDatabase, validate({ params: courseParams }), putProfile);

// matching
apiRouter.get('/courses/:courseId/candidates', validate({ params: courseParams }), getCandidates);

// match requests and groups (sdd 6.3.5 to 6.3.10)
apiRouter.post(
  '/courses/:courseId/requests',
  requireDatabase,
  validate({ params: courseParams, body: requestsController.sendBody }),
  requestsController.sendRequest
);
apiRouter.get('/courses/:courseId/requests', requireDatabase, validate({ params: courseParams }), requestsController.listRequests);
apiRouter.post(
  '/requests/:requestId/response',
  requireDatabase,
  validate({ params: requestsController.requestParams, body: requestsController.respondBody }),
  requestsController.respond
);
apiRouter.post(
  '/requests/:requestId/cancel',
  requireDatabase,
  validate({ params: requestsController.requestParams }),
  requestsController.cancel
);
apiRouter.get('/courses/:courseId/group', requireDatabase, validate({ params: courseParams }), requestsController.getGroup);
apiRouter.get(
  '/courses/:courseId/members/:studentId',
  requireDatabase,
  validate({ params: requestsController.memberParams }),
  requestsController.getMember
);

// peer reviews (sdd 6.3.11)
apiRouter.post('/groups/:groupId/reviews', requireDatabase, validate({ params: groupParams }), postReview);
