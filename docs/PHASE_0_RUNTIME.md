# Phase 0 runtime and dependency results

14 October 2026. Upstream SHA: `8e05997f2409275669c8344b84a51692e83f3f33`.

## Local execution

- Anonymous local Convex 1.41.0 CLI downloaded its native backend, configured `.env.local` and deployed original functions/indexes successfully. No account or cloud deployment created.
- Local backend listening at `http://127.0.0.1:3210`. The runtime stores state in `.convex/`, protected by its generated ignore file. Backend deployment regenerated `_generated` files; observed Git diffs had no semantic changes (line-ending normalisation).
- Initialised upstream map through `scripts/phase0-smoke.mjs init` with `numAgents: 0`. There are no scheduled social agents and no configured model credentials in this fresh local deployment.
- Status check: running world, running engine, zero agents.
- Human join returned `ok`; movement input returned `ok`, from `(29,13)` to `(30,13)`; a subsequent database query returned `(30,13)`. Zero agents remained.
- Vite 4.5.9 frontend is listening at `http://127.0.0.1:5173/ai-town/`. Node fetch received HTTP 200 and transformed index HTML; the main TypeScript module was also served. PowerShell Invoke-WebRequest with its default Accept header returned 404 on SPA fallback paths; this was not an unavailable server. Browser rendering has not been visually verified.
- An initial `convex run init` shell JSON attempt exited with a libuv assertion. A subsequent shell inline-code attempt lost quoting. File-based structured ConvexHttpClient initialisation succeeded; use the supplied smoke script.
- Seven Jest suites / 53 tests pass; production build passes; lint has 96 warnings and zero errors. No dependency upgrades applied.
- Original social conversations, embeddings and memory have not been exercised. No models called, including local inference. Fully autonomous upstream baseline validation remains outstanding.

## Dependency advisory audit

`npm.cmd audit --json` checked the locked tree against npm's advisory service. Report: **70 affected packages: 1 critical, 56 high, 11 moderate, 2 low**. These include transitive and development dependencies; counts are not 70 independently proven application exploits. The report is saved at workspace root as `phase0-npm-audit.json` (PowerShell UTF-16 output).

Critical package reported: transitive `shell-quote`, with [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p) and additional parse denial-of-service advisory. Direct affected packages include Clerk, Convex, Vite, PostCSS, Tailwind, Jest/ts-jest and TypeScript ESLint dependencies. Some proposed fixes are major upgrades.

Recommended next security increment before deployment: inspect dependency paths and actual attack surfaces; apply smallest compatible fixes; rerun baseline build/tests and local interaction. Do not use `npm audit fix --force` as a blanket remedy. No package changes were made during this audit, preserving reproducible upstream behaviour. Public deployment remains inappropriate given both advisories and confirmed server-auth gaps.

## Phase status

Phase 0 audit, provider feasibility documentation, installed baseline, static checks and zero-model runtime smoke are delivered. Phase 0 is **not fully closed** until browser verification and the intended original social-AI baseline choice are settled. Credentialed securities/FX quote freshness and provider publication rights remain explicitly open feasibility gates; official-trial eligibility is not claimed. No Phase 1 work has begun.
