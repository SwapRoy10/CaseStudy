# API reference

Base path: `/api`. In development the frontend calls it through the Vite proxy, so requests are same-origin.

## Signing in

Students sign in with their school email and password (`POST /api/session`). The response sets a `session` cookie that the browser keeps and sends on its own. It is HttpOnly and SameSite=Strict, it is signed with `SESSION_SECRET`, and it lasts 8 hours. The student id for every call comes from that cookie and nowhere else, see `backend/src/middleware/session.ts`. Signing out (`DELETE /api/session`) clears the cookie in the browser. A copied cookie keeps working until it expires, because sessions aren't stored on the server (SDD 9.4).

Passwords are hashed with Argon2id. There is no sign up, accounts have to exist before someone can sign in (SDD 9.3).

Every `POST`, `PUT` and `DELETE` that uses the cookie has to send `X-Requested-With: CaseStudy`. The frontend always does. Without it the call gets a 403, which stops other websites from sending changes with a student's cookie.

The old `X-Student-Id` header is gone and does nothing now.

For the local database and the demo, every sample student has the password `casestudy123`, for example `axr101@case.edu` or `mxc1001@case.edu`.

## Errors

Every error response has the same body:

```json
{ "error": { "code": "CONFLICT", "reason": "NO_PROFILE", "message": "Complete your profile to see matches." } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION` | Bad path param, malformed JSON body, or a roster file with unusable rows (`rows` lists them) |
| 401 | `UNAUTHENTICATED` | No signed-in student, an expired or made up cookie, or a wrong email or password |
| 403 | `FORBIDDEN` | A change sent without the `X-Requested-With` header, or a roster import without the operator key |
| 404 | `NOT_FOUND` | Unknown route |
| 409 | `CONFLICT` | A module threw `StateConflictError`; `reason` says which (SDD 10.3) |
| 429 | `RATE_LIMITED` | More than `RATE_LIMIT_MAX` requests (default 300) from one IP in 15 minutes. `/api/health` is exempt. Signing in is tighter: 10 wrong tries in 15 minutes |
| 503 | `UNAVAILABLE` | Any unexpected error, e.g. a failed database read. Details are logged on the server, never sent to the client |

`message` is written for end users and can be shown as-is.

Every response carries an `X-Request-Id` header (or echoes the one you sent). The same id appears in the server log line for that request, so a bug report with the id leads straight to the log.

## Endpoints

### `GET /api/health`

Public. Returns `{ "status": "ok", "uptimeSeconds": 12 }`.

### `POST /api/session`

Public, but needs the `X-Requested-With` header. Body is `{ "email": "axr101@case.edu", "password": "..." }`. The email can be in any case. On success it sets the session cookie and returns:

```json
{ "studentId": "101", "tutorialCompleted": false }
```

A wrong password and an email with no account get the same `401` and the same message, so nobody can use it to find out who has an account.

### `DELETE /api/session`

Needs the `X-Requested-With` header. Clears the cookie and returns `204`.

### `GET /api/me`

Signed in. Who the session belongs to and the courses they are on the roster of. The frontend calls it on load to see if someone is already signed in. It never sends the password hash.

```json
{
  "studentId": "101",
  "name": "Alex Rivera",
  "tutorialCompleted": false,
  "courses": [
    { "id": "1", "code": "SAMPLE 101", "title": "Sample Course (testing doc data)", "section": "001", "term": "Fall 2026", "hasProfile": true }
  ]
}
```

### `GET /api/demo/roster` and `POST /api/demo/session`

Demo only, and both are switched off when `NODE_ENV` is `production`. The roster lists each course that has profiles with the students on it (names and ids, never emails), and it needs no sign in. It reads from whichever database `DATABASE_URL` points at, so with Supabase set up the demo class list comes from Supabase. The sign in page uses it as a picker.

`POST /api/demo/session` takes `{ "studentId": "101" }` and signs you in as that student with no password, setting the same cookie as a normal sign in. It needs the `X-Requested-With` header like any other change, and answers `404` for a student that doesn't exist. Because it skips the password it must never be reachable on a real deployment, so run that one with `NODE_ENV=production`.

### `POST /api/operator/courses/:courseId/roster`

For the team operator, not students (SDD 6.5). It needs the `X-Operator-Key` header to match `OPERATOR_KEY` in `backend/.env`. If `OPERATOR_KEY` isn't set the route is off and always answers `403`. A signed in student gets the same `403`.

The body is the roster file, sent as `text/csv`. It can be either of these:

* **A Canvas gradebook export.** Canvas has no roster export of its own, so this is the one most people use: in the course go to Grades, then Export, then Export Entire Gradebook. It has the columns `Student, ID, SIS User ID, SIS Login ID, Section`, then one column per assignment. The school email is the `SIS Login ID` (the case id) plus `@case.edu`. The "Points Possible" row, the "Manual Posting" row and "Test Student" are skipped, and so are the assignment columns. If a file has an `Email` column instead, that is used as is. `SCHOOL_EMAIL_DOMAIN` in `.env` changes the domain.
* **The SDD format.** The columns `course_code, section, term, school_email`. Every row has to match the course in the url.

Excel can open the file and save it as CSV, but an `.xlsx` file isn't read, it has to be CSV.

```sh
curl -X POST localhost:4000/api/operator/courses/3/roster \
  -H "X-Operator-Key: $OPERATOR_KEY" -H "Content-Type: text/csv" \
  --data-binary @database/sample-canvas-roster.csv
```

```json
{ "enrolled": 36, "added": 0 }
```

`enrolled` is how many students the file had, and `added` is how many were not already on the roster. A student listed twice counts once.

The whole file is checked before anything is saved. If any row can't be used, nothing is saved and the answer is a `400` that lists each one with its row number in the sheet (the header is row 1):

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Some rows could not be matched, so nothing was imported.",
    "rows": [{ "row": 4, "reason": "no account for that email" }]
  }
}
```

The reasons are `no login id`, `no account for that email` and `row is for a different course`. A file with no login or email column at all gets `400` with `fields: ["header"]`, and an empty file gets `fields: ["file"]`. An unknown course gets `409`.

Students need an account first. The import only puts existing accounts on a roster, it doesn't create any.

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
