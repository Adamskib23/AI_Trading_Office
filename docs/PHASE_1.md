# Phase 1 — office foundations

Owner approved Phase 1 on 15 October 2026 after confirming the original town works. Phase 2 is not authorised. The v0.4 specification remains the approved architecture.

## What is implemented

- A separate office world, preserving the original Phase 0 town and its history. Bootstrap stops/archive-selects the original world without deleting it; repeat bootstrap returns the existing office.
- Five persistent employee profiles and avatar players: Alex, Sophie, Marcus, Nina and Oliver, each with the agreed preference/strategy, version 1, a distinct sprite and assigned desk. No social Agent objects or AI jobs are created in Phase 1.
- A 24 × 18 office map with collision-aware desks/walls, a CEO station and meeting table. Uses the existing Pixi tile renderer, sprites, pathfinding, historical movement and Convex subscriptions.
- A CEO setup dashboard with employee inspection, experiment status, planned capital, model lock, server-backed universe selection and an owner-action activity list. Planned $1,000 funding is explicitly not a portfolio balance.
- A typed 14-instrument registry covering stocks, broad ETFs, commodity ETF proxies, cash FX conversion and spot crypto. Selection is configuration only; all feed entitlements remain UNVERIFIED and no instrument can actually trade.
- Versioned 2026–2027 US regular-session calendar, DST handling, holidays and early closes. FX uses a weekend reference and otherwise remains UNVERIFIED until provider-specific hours are established. Crypto has continuous reference hours, with venue-health checks deferred to Phase 2. Calendar openness never certifies fresh prices or tradability.
- Typed server controls for pause/resume, avatar movement and instrument selection, with append-only application audit records.

## Architecture decisions

1. **Keep the upstream engine.** Employee avatars are normal persistent Player objects; movement goes through its input queue. Agent runtime is deliberately absent until Phase 3. The office has its own world rather than mutating/wiping baseline history.
2. **Local owner authentication.** A locally generated 256-bit bearer token is stored in ignored `.office/owner-token.txt` and the local Convex server environment (`OFFICE_OWNER_TOKEN`). The browser accepts it through CEO access, retains it only in memory and sends it only to protected mutations. Every owner mutation validates on the server. No secret is compiled into the frontend. This is a local development identity boundary, not a public deployment authentication rollout. Hosted owner identity/session management and TLS remain prerequisites for deployment.
3. **Close legacy write bypasses.** Office worlds reject anonymous join/leave, generic engine inputs, message writes and upstream public stop/resume. Default init refuses to populate an existing office. Internal deployment-admin operations remain trusted administrative capabilities, not browser controls. Read-only local observation and heartbeat remain public.
4. **Enforce no inference at the backend.** `OFFICE_PHASE=1` makes the upstream model configuration function reject before a request is constructed. Setup configures this lock before bootstrapping. It also protects against accidental use of inherited model utilities. No provider/model availability is assumed.
5. **No asset framework or image generator.** The new office tile atlas is original SVG source under the repository MIT terms. Existing character sprites are retained; their third-party publication rights remain an open asset audit item.
6. **No unofficial experiment launch.** Only SETUP exists in this phase. There is no start-trial endpoint, paper broker, portfolio or trading/research execution.

## Run and use

Open http://127.0.0.1:5173/ai-town/ or double-click `Start-Office.cmd`. The launcher starts missing services hidden with logs in `.office/`; it does not run upstream predev/init or enable agents. It invokes PowerShell with a per-process policy override, leaving machine execution policy unchanged. Local processes stop at shutdown; rerun the launcher afterwards. Native backend state remains in `.convex/`.

For a new local deployment: start Convex without `--run init`, then `node scripts/setup-office.mjs`. It generates the local secret, sets the inference lock and bootstraps idempotently. It refuses a configured cloud URL. The Windows CLI can assert on exit even after a successful mutation; setup confirms persisted backend state and owner authentication rather than assuming an exit proves success.

To use CEO controls, open `.office/owner-token.txt` locally, copy its contents into **CEO access**, then unlock. Do not share this token or film it. Select an employee and click an empty floor tile to move them. The market registry checkboxes change the proposed universe; every such change is logged. Pause applies to the visual office only in this phase. Refresh locks controls again. Observation does not require the token.

To rotate the token: generate a new secure random local token and update `OFFICE_OWNER_TOKEN` in the same local deployment, keeping the local file in sync. Existing browser tokens then fail server validation. Do not put token values in URLs, source, Git or screenshots.

## Verification

- Production TypeScript/Vite build passes; package.json and lockfile remain unchanged.
- Full lint passes with zero errors and 82 warnings (down from 96 in the upstream baseline); no blanket warning suppression was added.
- 8 Jest suites / 60 tests pass, including US DST/open-close/weekend/holiday/early-close/unsupported-year cases, FX reference boundaries, owner-token rejection, inference lock and desk reachability.
- Local backend integration verifies five persistent players/zero agents, 14 unverified instruments, 11 denied anonymous/legacy mutations, desk collision rejection, authenticated movement, selection persistence/restoration and pause resisting heartbeat restart.
- Headless installed Chrome verifies rendered canvas with all five avatars, 14 registry rows, disabled observer checkboxes, real CEO unlock, employee selection, map-click movement, refresh locking controls, and mobile layout without horizontal overflow. No page exceptions or failed resource requests after fixes.
- Browser testing found/fixed a Pixi wheel-listener teardown error when switching tabs, and corrected viewport resize/centering when the profile inspector changes height.
- Upstream browser console still warns about Convex function modules being imported through its shared world classes. No runtime exception resulted. Separate shared models from server registrations in a narrowly scoped future cleanup before upgrading Convex; no framework rewrite is needed.
- Existing dependency advisories, bundle-size and browserslist warnings remain disclosed in the Phase 0 audit. No bulk dependency upgrade was made.

## Git / remote status

Local development branch: `phase-1-office`, derived from upstream `8e05997f2409275669c8344b84a51692e83f3f33`. Upstream remote renamed from `origin` to `upstream` to avoid confusing upstream with the owner's fork. No owner GitHub destination/account connection has been supplied yet; no GitHub fork, push or remote publication is claimed. Connect GitHub and identify the target account/organisation, then create the upstream fork and add it as origin. No existing user work was discarded.

## Next checkpoint

Review the office visually and settle the remote fork. Review local owner access and provider-rights/account blockers before public deployment. Phase 2 requires separate owner approval, then proceeds to verified feeds and deterministic ledger/paper execution with scripted traders. No inference, web research or trading was run during Phase 1.

Calendar sources reviewed 15 October: [NYSE hours/holidays](https://www.nyse.com/trade/hours-calendars), [OANDA reference trading hours](https://www.oanda.com/us-en/trading/hours-of-operation/). FX provider binding remains unverified.
