import type {
  ApiErrorBody,
  CandidatesResponse,
  DemoCourse,
  GroupView,
  Id,
  MatchedProfile,
  Me,
  OwnProfile,
  ProfileInput,
  RequestRecord,
  ReviewRating,
} from '../types/api';

// every backend call goes through this file, so the url, headers and error
// handling live in one place. pages call api.getCandidates(...) etc.

// empty means same origin, the vite proxy forwards /api to the backend.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

// the session is a cookie the browser keeps and sends by itself, so nothing here
// handles it. when any call comes back 401 the session is over, so the app
// registers a function here that takes the student back to the sign in screen.
let onSignedOut: (() => void) | null = null;
export function setSignedOutHandler(handler: (() => void) | null) {
  onSignedOut = handler;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string, // e.g. CONFLICT, UNAVAILABLE, or NETWORK if the server never answered
    message: string,
    public reason?: string, // e.g. NO_PROFILE for CONFLICT
    public fields?: string[] // the bad fields on a VALIDATION error
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  // the backend turns away changes without this, which stops other sites sending them (sdd 9.4)
  headers.set('X-Requested-With', 'CaseStudy');

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', "Can't reach the server. Is the backend running?");
  }

  // the proxy answers 502/504 with an empty or HTML body when the backend is down
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) onSignedOut?.();
    const err = (body as ApiErrorBody | null)?.error;
    if (err) throw new ApiRequestError(res.status, err.code, err.message, err.reason, err.fields);
    throw new ApiRequestError(res.status, 'NETWORK', "Can't reach the server. Is the backend running?");
  }
  return body as T;
}

export const api = {
  health: () => request<{ status: 'ok'; uptimeSeconds: number }>('/health'),

  getCandidates: (courseId: Id) =>
    request<CandidatesResponse>(`/courses/${encodeURIComponent(courseId)}/candidates`),

  signIn: (email: string, password: string) =>
    request<{ studentId: Id; tutorialCompleted: boolean }>('/session', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signOut: () => request<null>('/session', { method: 'DELETE' }),

  // who is signed in, and their courses. 401 means nobody is
  getMe: () => request<Me>('/me'),

  getProfile: (courseId: Id) => request<OwnProfile>(`/courses/${encodeURIComponent(courseId)}/profile`),

  saveProfile: (courseId: Id, profile: ProfileInput) =>
    request<OwnProfile>(`/courses/${encodeURIComponent(courseId)}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),

  // match requests
  getRequests: (courseId: Id) =>
    request<{ courseId: Id; requests: RequestRecord[] }>(`/courses/${encodeURIComponent(courseId)}/requests`),

  sendRequest: (courseId: Id, recipientId: Id) =>
    request<RequestRecord>(`/courses/${encodeURIComponent(courseId)}/requests`, {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    }),

  respondToRequest: (requestId: Id, decision: 'ACCEPT' | 'DECLINE') =>
    request<RequestRecord>(`/requests/${encodeURIComponent(requestId)}/response`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),

  cancelRequest: (requestId: Id) =>
    request<RequestRecord>(`/requests/${encodeURIComponent(requestId)}/cancel`, { method: 'POST' }),

  // groups and reviews
  getGroup: (courseId: Id) => request<{ group: GroupView | null }>(`/courses/${encodeURIComponent(courseId)}/group`),

  getMatchedProfile: (courseId: Id, studentId: Id) =>
    request<MatchedProfile>(`/courses/${encodeURIComponent(courseId)}/members/${encodeURIComponent(studentId)}`),

  submitReview: (groupId: Id, revieweeId: Id, ratings: ReviewRating[]) =>
    request<{ reviewId: Id; revieweeAverage: number }>(`/groups/${encodeURIComponent(groupId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ revieweeId, ratings }),
    }),

  // account
  changePassword: (currentPassword: string, newPassword: string) =>
    request<null>('/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),

  completeTutorial: () => request<null>('/me/tutorial-complete', { method: 'POST' }),

  // demo only: the students you can pick from, and signing in as one without a password
  getDemoRoster: () => request<{ courses: DemoCourse[] }>('/demo/roster'),
  demoSignIn: (studentId: Id) =>
    request<{ studentId: Id; tutorialCompleted: boolean }>('/demo/session', {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    }),
};
