import express, { Router } from 'express';
import { getHealth } from '../controllers/health.controller';
import { getCandidates } from '../controllers/candidates.controller';
import { getCourses } from '../controllers/courses.controller';
import { getDemoRoster } from '../controllers/demo.controller';
import { demoSignIn, demoSignInBody } from '../controllers/demoSession.controller';
import { changePassword, completeTutorial, getCurrentStudent, passwordBody } from '../controllers/me.controller';
import { getProfile, putProfile } from '../controllers/profile.controller';
import * as requestsController from '../controllers/requests.controller';
import { groupParams, postReview } from '../controllers/reviews.controller';
import { importRosterFile, rosterQuery } from '../controllers/roster.controller';
import { signIn, signInBody, signOut } from '../controllers/session.controller';
import { config } from '../config';
import { requireOperator } from '../middleware/operator';
import { requireClientHeader, requireStudent } from '../middleware/session';
import { courseParams, validate } from '../middleware/validate';

// all api routes, mounted at /api in app.ts, logic lives in the controllers
export const apiRouter = Router();

// public
apiRouter.get('/health', getHealth);

// demo only, pick a student without a login
if (config.demoRoutes) {
  apiRouter.get('/demo/roster', getDemoRoster);
}

// operator route, key checked first (excel may label csv as vnd.ms-excel)
apiRouter.post(
  '/operator/courses/:courseId/roster',
  requireOperator,
  express.text({ type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'], limit: '1mb' }),
  validate({ params: courseParams, query: rosterQuery }),
  importRosterFile
);

// below here changes must carry the client header
apiRouter.use(requireClientHeader);

apiRouter.post('/session', validate({ body: signInBody }), signIn);
apiRouter.delete('/session', signOut);

// demo only, sign in as the picked student
if (config.demoRoutes) {
  apiRouter.post('/demo/session', validate({ body: demoSignInBody }), demoSignIn);
}

// below here needs a signed in student
apiRouter.use(requireStudent);

apiRouter.get('/me', getCurrentStudent);
apiRouter.get('/courses', getCourses);
apiRouter.put('/me/password', validate({ body: passwordBody }), changePassword);
apiRouter.post('/me/tutorial-complete', completeTutorial);

// profile (sdd 6.3.2, 6.3.3)
apiRouter.get('/courses/:courseId/profile', validate({ params: courseParams }), getProfile);
apiRouter.put('/courses/:courseId/profile', validate({ params: courseParams }), putProfile);

// matching
apiRouter.get('/courses/:courseId/candidates', validate({ params: courseParams }), getCandidates);

// match requests and groups (sdd 6.3.5 to 6.3.10)
apiRouter.post(
  '/courses/:courseId/requests',
  validate({ params: courseParams, body: requestsController.sendBody }),
  requestsController.sendRequest
);
apiRouter.get('/courses/:courseId/requests', validate({ params: courseParams }), requestsController.listRequests);
apiRouter.post(
  '/requests/:requestId/response',
  validate({ params: requestsController.requestParams, body: requestsController.respondBody }),
  requestsController.respond
);
apiRouter.post(
  '/requests/:requestId/cancel',
  validate({ params: requestsController.requestParams }),
  requestsController.cancel
);
apiRouter.get('/courses/:courseId/group', validate({ params: courseParams }), requestsController.getGroup);
apiRouter.get(
  '/courses/:courseId/members/:studentId',
  validate({ params: requestsController.memberParams }),
  requestsController.getMember
);

// peer reviews (sdd 6.3.11)
apiRouter.post('/groups/:groupId/reviews', validate({ params: groupParams }), postReview);
