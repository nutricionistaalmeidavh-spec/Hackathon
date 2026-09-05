# Where's the Money — Final Hackathon Smoke Checklist

## Scope freeze

Use this checklist for the hackathon candidate. From this point forward, accept only bug fixes, copy corrections and low-risk visual polish. Do not change financial engines, Worker/API contracts, Gemini prompts/routes, Pluggy contracts, RevenueCat entitlement logic or persistence unless a blocking defect is proven.

## Web candidate

- [ ] Open the production root and confirm the Home renders without console-visible failure.
- [ ] Open `?demo=1` and confirm Demo Pro starts with synthetic data.
- [ ] Confirm the bottom navigation remains: Hoje, Inbox, Radar, Planejar, Mais.
- [ ] Confirm no personal/real user data appears in Demo.
- [ ] Confirm exiting Demo restores the previous real/local state.
- [ ] Confirm `Reiniciar demo` restores the original synthetic scenario without changing the real-state snapshot.

## Demo judge flow

Target: a continuous 90–110 second walkthrough without external-service dependency.

1. [ ] Start Demo Pro.
2. [ ] Home shows exactly 2 decisions to review.
3. [ ] Open the first ambiguous transaction and categorize it.
4. [ ] `Salvar e ver próxima` opens the second decision automatically.
5. [ ] Resolve the second decision.
6. [ ] The guide remains on review until both decisions are resolved.
7. [ ] Inbox changes to `Tudo revisado` and offers `Ver meu Radar`.
8. [ ] Open Radar and confirm a meaningful 30-day projection and point of attention render.
9. [ ] Continue with `Organizar meu plano`.
10. [ ] Planner opens with the synthetic goals/context already available.
11. [ ] Advanced planning sections remain available without requiring Gemini to complete the core walkthrough.
12. [ ] Restart Demo and repeat the sequence from the original state.

## Failure containment

- [ ] Trigger or mock a malformed statement import: existing data remains intact, busy state clears, file input resets and the UI shows a friendly error.
- [ ] Confirm an error/cancellation does not render with the success check treatment.
- [ ] Confirm informational states such as `Sincronizando…` and `Abrindo assinatura Pro…` use neutral feedback.
- [ ] Pluggy unavailable: the user can still continue via Free import or Demo.
- [ ] Gemini unavailable: core Inbox → Radar → Planner demo remains usable.
- [ ] RevenueCat unavailable/unconfigured: the app remains navigable and clearly explains that checkout is unavailable.
- [ ] Contextual Pro dialog closes from the close button, backdrop and Escape key.

## Android simulator — NexGen validation only

There is no iPhone validation in this final phase. There is no native-store publication step for NexGen.

- [ ] Run mobile tests.
- [ ] Run TypeScript/typecheck.
- [ ] Validate Expo config.
- [ ] Run Expo Doctor.
- [ ] Launch the Android simulator build/session used by the project.
- [ ] Confirm initial WebView/native shell loads.
- [ ] Confirm Android back/navigation does not strand the user in a modal/detail state.
- [ ] Confirm subscription bridge absence/configuration errors do not block the product flow.
- [ ] Confirm Demo Pro is usable in the Android simulator.
- [ ] Confirm no iOS/iPhone testing or native publishing is required for this candidate.

## Automated release checks

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx wrangler deploy --dry-run`
- [ ] `npx wrangler deploy --assets=./dist --name=hackathon --dry-run`
- [ ] Mobile CI: tests + typecheck + Expo config + Expo doctor
- [ ] Diff review confirms no changes in `worker/`, `server/`, financial engines or external integration contracts.
- [ ] GitHub CI green on the final branch commit.
- [ ] Cloudflare Workers build green after merge to `main`.

## Final freeze record

Record after merge:

- Final `main` commit: _pending_
- Cloudflare Build ID: _pending_
- Cloudflare Version ID: _pending_
- Hackathon tag/release: create only after Steps 3–5 materials are locked.
