# CaseStudy React frontend

React 19 + Vite + TypeScript.

```bash
npm install
npm run dev     # http://localhost:5173 (start the backend too, or use `npm run dev` from the repo root)
```

## Talking to the backend

- Call the backend only through `src/services/api.ts`. Add one function per endpoint there.
- In dev, requests to `/api/...` are proxied to `http://localhost:4000` (see `vite.config.ts`), so there's no CORS setup.
- Failed calls throw `ApiRequestError` with `code`, `reason` and a user-facing `message`. `code: 'NETWORK'` means the backend couldn't be reached.
- Response types live in `src/types/api.ts` and mirror `backend/src/matching/types.ts`.

The current page and styles are a working integration shell, ready to be redesigned.
