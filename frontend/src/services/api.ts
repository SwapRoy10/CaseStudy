import type { ApiErrorBody, CandidatesResponse, Id } from '../types/api';

// Every backend call goes through this file, so the URL, headers and error
// handling live in one place. Pages call api.getCandidates(...) etc.

// Empty = same origin; the Vite proxy forwards /api to the backend.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

// DEMO STAND-IN for real login: the backend reads the student from this header.
// When auth exists, delete this and let the session cookie do the work.
let currentStudentId: Id | null = null;
export function setDemoStudent(id: Id | null) {
  currentStudentId = id;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string, // e.g. STATE_CONFLICT, UNAVAILABLE, or NETWORK if the server never answered
    message: string,
    public reason?: string // e.g. NO_PROFILE for STATE_CONFLICT
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (currentStudentId) headers.set('X-Student-Id', currentStudentId);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', "Can't reach the server. Is the backend running?");
  }

  // The proxy answers 502/504 with an empty or HTML body when the backend is down
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    if (err) throw new ApiRequestError(res.status, err.code, err.message, err.reason);
    throw new ApiRequestError(res.status, 'NETWORK', "Can't reach the server. Is the backend running?");
  }
  return body as T;
}

export const api = {
  health: () => request<{ status: 'ok'; uptimeSeconds: number }>('/health'),

  getCandidates: (courseId: Id) =>
    request<CandidatesResponse>(`/courses/${encodeURIComponent(courseId)}/candidates`),
};
