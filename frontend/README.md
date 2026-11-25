# CaseStudy frontend

React 19, Vite, TypeScript.

```bash
npm install
npm run dev     # http://localhost:5173 (start the backend too, or use `npm run dev` from the repo root)
npm test        # unit tests for the availability grid logic
```

## Talking to the backend

- call the backend only through `src/services/api.ts`, one function per endpoint
- in dev `/api/...` is proxied to `http://localhost:4000` (see `vite.config.ts`), so no cors setup
- failed calls throw `ApiRequestError` with `code`, `reason` and a `message` for the user. `code: 'NETWORK'` means the backend was unreachable
- response types live in `src/types/api.ts`, mirroring `backend/src/matching/types.ts`
