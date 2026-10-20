# API reference

Base path: `/api`. In development the frontend calls it through the Vite proxy, so requests are same-origin.

## Auth (temporary)

Until real login exists, signed-in routes read the student id from an `X-Student-Id` header (`backend/src/middleware/session.ts`). The frontend sets it from the demo student picker. Replacing this with a real session should only touch that middleware.

## Errors

Every error response has the same body:

```json
{ "error": { "code": "STATE_CONFLICT", "reason": "NO_PROFILE", "message": "Complete your profile to see matches." } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION` | Bad path param or malformed JSON body |
| 401 | `UNAUTHENTICATED` | No signed-in student |
| 404 | `NOT_FOUND` | Unknown route |
| 409 | `STATE_CONFLICT` | A module threw `StateConflictError`; `reason` says which (SDD 10.3) |
| 429 | `RATE_LIMITED` | More than `RATE_LIMIT_MAX` requests (default 300) from one IP in 15 minutes. `/api/health` is exempt |
| 503 | `UNAVAILABLE` | Any unexpected error, e.g. a failed database read. Details are logged on the server, never sent to the client |

`message` is written for end users and can be shown as-is.

Every response carries an `X-Request-Id` header (or echoes the one you sent). The same id appears in the server log line for that request, so a bug report with the id leads straight to the log.

## Endpoints

### `GET /api/health`

Public. Returns `{ "status": "ok", "uptimeSeconds": 12 }`.

### `GET /api/courses/:courseId/candidates`

Signed in. Ranked study-partner candidates for the signed-in student in this course (SDD 6.3.4). The order is the ranking; there is no cap.

```json
{
  "courseId": "1",
  "candidates": [
    {
      "candidateId": "102",
      "gradeGoal": "A_TRACK",
      "workStyle": "GROUP",
      "sharedIntervals": [{ "weekday": 1, "startMinute": 600, "endMinute": 660 }],
      "reviewAverage": 3.2
    }
  ]
}
```

`weekday` is 0–6 (Sunday = 0); minutes are from midnight, America/New_York. `reviewAverage` is `null` when the candidate has no reviews.

Errors: `409 NO_PROFILE` if the student has no profile or no availability for the course.
