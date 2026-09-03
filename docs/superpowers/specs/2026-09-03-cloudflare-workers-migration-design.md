# Cloudflare Workers Migration Design

## Goal

Convert the current Cloudflare Pages + Pages Functions deployment into a single Cloudflare Worker that serves the Vite/React frontend and the Open Finance API under the existing same-origin URLs, without requiring further Cloudflare dashboard changes.

## Current State

- Frontend: Vite + React + TypeScript, built to `dist/`.
- Backend routes currently implemented as Cloudflare Pages Functions under `functions/api/open-finance/*`.
- Shared Pluggy server logic lives in `server/pluggy.ts` and already uses Web Platform APIs (`fetch`, `Request`, `Response`) compatible with Workers.
- `wrangler.toml` currently uses `pages_build_output_dir = "./dist"`, which forces Pages behavior and conflicts with the Worker project already created in Cloudflare.
- The Cloudflare project name that must remain is `hackathon`.

## Target Architecture

A single ES Module Worker will be the runtime entry point.

```text
Browser
  |
  |-- /api/open-finance/* --> worker/index.ts --> server/pluggy.ts --> Pluggy REST API
  |
  `-- everything else ----> Cloudflare Static Assets binding --> dist/
```

The Worker will route API requests before static assets. Non-API requests will be served by the static assets binding, with SPA fallback to `index.html` for client-side routes.

## Public API Contract

The migration must preserve the existing routes and methods exactly:

- `GET /api/open-finance/status`
- `POST /api/open-finance/connect-token`
- `POST /api/open-finance/data`
- `POST /api/open-finance/webhook`

Unknown `/api/*` paths return JSON 404. Unsupported methods on known API paths return JSON 405.

Frontend calls in `src/integrations/pluggy.ts` remain same-origin and require no URL changes.

## Worker Entry Point

Create `worker/index.ts` as the single Worker entry point. It will:

1. inspect `request.method` and `new URL(request.url).pathname`;
2. dispatch supported API paths to focused route handlers;
3. return JSON 404/405 for invalid API requests;
4. delegate all non-API traffic to `env.ASSETS.fetch(request)`.

The Pages-specific `functions/` tree will no longer be part of runtime deployment after equivalent Worker handlers are present and tested.

## Route Handler Structure

Create focused route modules under `worker/routes/open-finance/`:

- `status.ts`
- `connect-token.ts`
- `data.ts`
- `webhook.ts`

They will reuse the existing helpers from `server/pluggy.ts` and preserve current status codes and response shapes.

## Environment and Secrets

Worker environment type:

```ts
type Env = PluggyEnv & {
  ASSETS: Fetcher;
};
```

`PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET` remain server-side bindings only. They must never be prefixed with `VITE_`, committed with real values, or exposed to the browser bundle.

The deploy itself must succeed even when Pluggy secrets are absent. In that case the frontend loads normally and `/api/open-finance/status` reports the integration as not configured.

## Wrangler Configuration

Replace the Pages configuration with Worker configuration equivalent to:

```toml
name = "hackathon"
main = "./worker/index.ts"
compatibility_date = "2026-09-03"
preview_urls = true

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]
```

`pages_build_output_dir` must be removed completely so Wrangler no longer identifies the repository as a Pages project.

The existing Cloudflare deploy command `npx wrangler deploy --assets=./dist --name=hackathon` must work without further dashboard edits. Repository configuration must also allow plain `npx wrangler deploy` to work locally.

## Package and TypeScript Configuration

- Replace Pages-specific scripts (`dev:pages`, `deploy:pages`) with Worker equivalents.
- Build remains responsible for TypeScript checks plus `vite build`.
- Replace `tsconfig.functions.json` with a Worker-oriented TypeScript config that includes `worker/**/*.ts` and `server/**/*.ts`.
- Keep the frontend build output at `dist/`.

## Static Asset and SPA Behavior

- `/api/*` always reaches the Worker first.
- Existing asset files are served from `dist/`.
- Unknown frontend routes fall back to `dist/index.html` so direct navigation to client-side routes does not 404.
- API 404s must never fall back to the SPA.

## Testing

Add automated tests for the Worker router covering at minimum:

1. `GET /api/open-finance/status` without Pluggy secrets returns the current `configured: false` response.
2. known route with wrong HTTP method returns 405.
3. unknown `/api/*` route returns JSON 404.
4. non-API request delegates to `ASSETS.fetch`.
5. Pluggy route handlers preserve their request validation behavior.

Existing finance-engine tests must continue to pass.

Before completion, run:

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

The dry run must identify the project as a Worker, compile the Worker entry point, and include the static assets configuration without any Pages-specific warning.

## Documentation Updates

Update `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` so Cloudflare Workers + Static Assets is the documented runtime. Remove statements that Pages/Pages Functions are the current runtime.

## Deployment Trigger

After tests and dry-run validation pass, commit the completed migration to `main`. The commit itself is the intended trigger for the existing Git-connected Cloudflare project to start a fresh build and deploy.

## Non-Goals

- No UI redesign.
- No change to finance-engine behavior.
- No migration of `localStorage` persistence.
- No exposure or rotation of Pluggy credentials.
- No Cloudflare dashboard reconfiguration.
- No change to the public Open Finance API URLs.
