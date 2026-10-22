# CaseStudy

Find study partners in your course, matched on grade goal and shared free time.

## Quick start

Needs Node 22+.

```bash
npm run setup     # installs root, backend and frontend dependencies
npm run dev       # backend on :4000 + frontend on :5173, both auto-reload
```

Open http://localhost:5173. The green "API connected" dot means the frontend is reaching the backend.

Until login exists, use the **Demo student** picker to switch between students. X

## Running the demo

```bash
npm run demo        # builds both, serves the production build on :4173
npm run smoke:demo  # in a second terminal: checks frontend ↔ backend end to end
```

Full walkthrough: [docs/demo/checklist.md](docs/demo/checklist.md).

## Scripts (run from the repo root)

| Script | What it does |
| --- | --- |
| `npm run setup` | Install everything |
| `npm run dev` | Run backend + frontend in dev mode |
| `npm run demo` | Build and run the production version |
| `npm test` | Backend tests (matching + API) |
| `npm run typecheck` | Typecheck backend and frontend |
| `npm run smoke` | Integration check against running dev servers |

## Layout

```
CaseStudy/
├── frontend/            React + Vite (Member 3)
│   └── src/
│       ├── components/  Reusable UI
│       ├── pages/       One file per screen
│       ├── services/    api.ts: every backend call goes through here
│       └── types/       Mirrors backend types
├── backend/             Express + TypeScript (Members 1, 2, 4)
│   └── src/
│       ├── routes/      URL → controller (Member 1)
│       ├── controllers/ Validate input, call a module, send response (Member 1)
│       ├── middleware/  Session, error → HTTP mapping (Member 1)
│       ├── matching/    Matching algorithm + its tests (Member 4)
│       ├── profile/     (Member 2, to add)
│       ├── enrollment/  (Member 2, to add)
│       ├── app.ts       Builds the Express app
│       └── server.ts    Starts it
├── database/            Migrations and seed data (Member 2)
├── docs/                Algorithm notes, API reference, demo plan
├── scripts/smoke.mjs    End-to-end check used by `npm run smoke` and CI
└── .github/workflows/   CI: tests, builds, and a full demo smoke test
```

Feature modules (`matching/`, `profile/`, `enrollment/`) sit directly under `backend/src/` and keep their tests next to the code. Each module throws typed errors (`StateConflictError`), and `middleware/errorHandler.ts` turns them into HTTP responses (SDD 10.3), so modules never deal with Express.
