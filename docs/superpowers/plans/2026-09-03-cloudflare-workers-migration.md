# Cloudflare Workers Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cloudflare Pages + Pages Functions with one Cloudflare Worker named `hackathon` that serves the Vite SPA and the existing Open Finance API without dashboard changes.

**Architecture:** `worker/index.ts` becomes the single Worker entry point. It routes `/api/open-finance/*` to focused handlers that reuse `server/pluggy.ts`, while all non-API requests delegate to the `ASSETS` binding backed by `dist/`. Wrangler owns SPA fallback and runs the Worker first for `/api/*`.

**Tech Stack:** TypeScript 5.7, Vite 6, React 19, Vitest 2, Wrangler 4, Cloudflare Workers Static Assets.

**Spec:** `docs/superpowers/specs/2026-09-03-cloudflare-workers-migration-design.md`

## Global Constraints

- Cloudflare Worker project name remains exactly `hackathon`.
- Existing Open Finance URLs and methods remain unchanged.
- `PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET` stay server-side only and are never committed.
- `dist/` remains the frontend build directory.
- No Cloudflare dashboard changes.
- Existing finance-engine behavior and UI stay unchanged.
- Completion requires `npm test`, `npm run build`, and `npx wrangler deploy --dry-run` to pass without Pages warnings.

---

### Task 1: Specify Worker routing behavior with tests

**Files:**
- Create: `worker/index.test.ts`
- Create later in Task 2: `worker/index.ts`

**Interfaces:**
- Consumes: Web `Request`/`Response` APIs and an `ASSETS.fetch(request)` binding.
- Produces: default Worker export with `fetch(request, env): Promise<Response>`.

- [ ] **Step 1: Write failing router tests**

Create tests that import the not-yet-existing Worker and assert:

```ts
import { describe, expect, it, vi } from 'vitest';
import worker from './index';

const makeEnv = () => ({
  PLUGGY_CLIENT_ID: undefined,
  PLUGGY_CLIENT_SECRET: undefined,
  ASSETS: { fetch: vi.fn(async () => new Response('asset-response')) },
});

describe('Worker router', () => {
  it('reports Pluggy as unconfigured when secrets are absent', async () => {
    const env = makeEnv();
    const response = await worker.fetch(new Request('https://example.com/api/open-finance/status'), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ configured: false, authenticated: false, code: 'missing' });
  });

  it('returns 405 for a known route with the wrong method', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/open-finance/status', { method: 'POST' }), makeEnv());
    expect(response.status).toBe(405);
  });

  it('returns JSON 404 for an unknown API route', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/unknown'), makeEnv());
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('delegates non-API requests to ASSETS', async () => {
    const env = makeEnv();
    const request = new Request('https://example.com/dashboard');
    const response = await worker.fetch(request, env);
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe('asset-response');
  });

  it('keeps data request validation', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/open-finance/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }), makeEnv());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'itemId is required.' });
  });
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npx vitest run worker/index.test.ts`

Expected: FAIL because `./index` does not exist.

---

### Task 2: Port Pages Functions into the Worker runtime

**Files:**
- Create: `worker/types.ts`
- Create: `worker/index.ts`
- Create: `worker/routes/open-finance/status.ts`
- Create: `worker/routes/open-finance/connect-token.ts`
- Create: `worker/routes/open-finance/data.ts`
- Create: `worker/routes/open-finance/webhook.ts`
- Reuse: `server/pluggy.ts`

**Interfaces:**
- Consumes: `PluggyEnv`, existing Pluggy helpers, and `ASSETS.fetch`.
- Produces: route functions `(request: Request, env: Env) => Promise<Response>` and a single Worker `fetch` dispatcher.

- [ ] **Step 1: Add Worker environment types**

```ts
import type { PluggyEnv } from '../server/pluggy';

export type AssetFetcher = { fetch(request: Request): Promise<Response> };
export type Env = PluggyEnv & { ASSETS: AssetFetcher };
export type RouteHandler = (request: Request, env: Env) => Promise<Response>;
```

- [ ] **Step 2: Port the four route handlers without changing response contracts**

Move the behavior from `functions/api/open-finance/*.ts` into focused `handleStatus`, `handleConnectToken`, `handleData`, and `handleWebhook` functions under `worker/routes/open-finance/`, preserving current validation/status behavior and imports from `server/pluggy.ts`.

- [ ] **Step 3: Implement the Worker router**

`worker/index.ts` will use an exact route table for the four API paths. Known path + wrong method returns `jsonResponse({ error: 'Method not allowed.' }, 405)`, unknown `/api/*` returns `jsonResponse({ error: 'Not found.' }, 404)`, and non-API traffic returns `env.ASSETS.fetch(request)`.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run: `npx vitest run worker/index.test.ts`

Expected: all Worker router tests PASS.

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: Worker tests and existing finance-engine tests PASS.

---

### Task 3: Convert build and Wrangler configuration from Pages to Workers

**Files:**
- Modify: `wrangler.toml`
- Modify: `package.json`
- Create: `tsconfig.worker.json`
- Delete: `tsconfig.functions.json`
- Delete: `functions/api/open-finance/status.ts`
- Delete: `functions/api/open-finance/connect-token.ts`
- Delete: `functions/api/open-finance/data.ts`
- Delete: `functions/api/open-finance/webhook.ts`

**Interfaces:**
- Consumes: `worker/index.ts` and Vite output `dist/`.
- Produces: Worker deployment compatible with both plain `npx wrangler deploy` and the existing Cloudflare command `npx wrangler deploy --assets=./dist --name=hackathon`.

- [ ] **Step 1: Replace Pages Wrangler config**

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

- [ ] **Step 2: Replace Pages scripts and TypeScript check**

Use Worker scripts:

```json
"dev:worker": "npm run build && wrangler dev",
"build": "tsc -b && tsc -p tsconfig.worker.json --noEmit && vite build",
"deploy:worker": "npm run build && wrangler deploy"
```

Create `tsconfig.worker.json` using the former server-side compiler options with `include: ["worker/**/*.ts", "server/**/*.ts"]`.

- [ ] **Step 3: Remove Pages Function runtime files**

Delete the four files under `functions/api/open-finance/` once equivalent Worker handlers are green.

- [ ] **Step 4: Verify production build**

Run: `npm run build`

Expected: TypeScript and Vite build PASS and `dist/` is generated.

- [ ] **Step 5: Verify Wrangler Worker compilation**

Run: `npx wrangler deploy --dry-run`

Expected: Wrangler recognizes a Worker, bundles `worker/index.ts`, includes static assets, and emits no Pages-specific warning.

- [ ] **Step 6: Verify the exact Cloudflare dashboard deploy command**

Run: `npx wrangler deploy --assets=./dist --name=hackathon --dry-run`

Expected: PASS with the same Worker entry point and no Pages-specific warning.

---

### Task 4: Update architecture docs and final verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DECISIONS.md`
- Modify: `README.md` only if it contains Pages deployment instructions.

**Interfaces:**
- Produces: documentation matching the deployed Worker runtime.

- [ ] **Step 1: Replace current-runtime Pages references**

Document the architecture as:

```text
src/integrations/pluggy.ts
   ↓ same-origin HTTP
worker/index.ts
   ↓ route handlers
server/pluggy.ts
   ↓ HTTPS
Pluggy Sandbox / Open Finance

non-API traffic
   ↓
env.ASSETS.fetch(request)
   ↓
dist/
```

Record the Worker + Static Assets decision and preserve the secret-management rationale.

- [ ] **Step 2: Run complete verification from a clean dependency install**

Run:

```bash
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy --assets=./dist --name=hackathon --dry-run
```

Expected: every command exits 0; no Pages warning appears.

- [ ] **Step 3: Commit migration to `main`**

Commit message: `cloudflare: migrate Hackathon from Pages to Workers`

The push to `main` is the production build trigger for the already-linked Cloudflare Worker project.
