# Development logbook

## 15 October 2026 — automatic actual-feed acceptance passed; overnight check running

After the shared refresh fix, TEST nx71v1c17d7t734xq0a622y44d8gbtxz filled all five required categories without manual feed refreshes, reconciled all accounts, and acquired all four benchmark sleeves. The runner checked original source/retrieval clocks after acceptance/start and automatically paused the run. A second actual backend/supervisor restart preserved its filled portfolios, orders/fills/source metadata and benchmark state exactly.

Started the bounded real UTC rollover observation on that verified TEST. Automatic check/stop: 2026-10-16T00:06:00Z (01:06 BST). No new proposals, models or research are scheduled. Midnight result is pending, not passed. Machine/local backend must remain awake; browser is unnecessary. Terminal prices remain off. Current checks: 14 suites / 114 unit tests, build, targeted lint, persisted recovery/queue/admission tests and browser checks pass. Phase 3 remains disabled.

## 15 October 2026 — first actual-feed fills and a refresh scheduling gap

US-open AAPL/SPY/GLD quotes at 13:30 UTC were about six seconds old and passed source review. TEST nx77jt2xd94n6xp6basnbkpw7h8ga6xf then produced all five required actual-feed paper fills, five reconciled portfolios and all four benchmark acquisitions. GLD initially returned a source minute before order acceptance and was correctly held; a manual data refresh supplied a later quote. This intervention is recorded explicitly and the run is not labelled unattended.

Fixed the underlying single-follow-up assumption with one shared durable refresh per instrument, generation-based coalescing and TTL/deadline-bounded repeats. Unit tests cover expired/paused/completed/fixture isolation; persisted fixture checks cover shared slots, obsolete/early claims and zero provider work for fixture IDs. Acceptance is being rerun without manual provider requests. No risk or freshness thresholds were weakened.

## 15 October 2026 — Kraken review and remaining Phase 2 acceptance

Owner confirmed their Kraken terms review permits current internal use without redistribution. Recorded this scope for three crypto instruments, preserving other settings and leaving terminal prices off. Independently reviewed Twelve Data Forex API v2, weekday source freshness, NYSE sessions and short AAPL/SPY/GLD corporate-action evidence; see PHASE_2_ACCEPTANCE.md. These are engineering checks, not agent research integration.

Stopped only the verified local Convex backend process (PID 25200) and its Convex dev supervisor (PID 26472), then restarted the same checkout without altering data files or opening a browser. All five funding-only provider TEST accounts, balances, paused status and reconciliation persisted. A recovery fixture scheduled before shutdown completed after restart.

Added bounded midnight refreshes and a finite provider day-check with automatic stop; tested rejection before required acceptance fills and for invalid owner access. An isolated fixture verifies deadline admission before cron, and existing expiry/reconciliation checks still pass. Fill/benchmark records now retain source and retrieval clocks. Body-fetch timeout coverage added. No model calls, subscriptions, publication or official trial.

## 15 October 2026 — temporary Twelve Data paper permission; terminal prices off

Owner clarified the permission was from Twelve Data, that Kraken had not been contacted, and requested terminal display be switchable and off for now. Recorded owner-reported temporary internal paper rights for all 11 Twelve Data instruments through the existing authenticated review endpoint, preserving every session/source/corporate-action value. Kraken reviews were unchanged. No provider requests, paper orders or subscription changes were made for that update.

Added a persisted CEO-only terminal-price toggle, default off, with audit events and a dedicated query that omits price fields while disabled. Timing/health metadata remains visible and financial data ingestion is independent of presentation. No publication or real-money permission is inferred.

## 15 October 2026 — clock repaired; all symbols retrieved; Phase 2 still active

Owner synchronized Windows after three external clocks (Kraken, Microsoft and Cloudflare) agreed approximately one hour ahead of local UTC and Windows Time was found stopped. The earlier independent-clock check followed the same local clock and could not establish a Kraken fault. After synchronization, observed differences were under one second. EUR/USD and BTC/ETH/SOL immediately passed timestamp and closed-candle checks. All eight US symbols plus all three FX pairs and all three crypto pairs now have retrieval evidence. US quotes are previous closes, not open-session execution proof. No source timestamp was corrected in code.

Added secret-safe numeric feed diagnostics, automatic minute-by-minute provider-account reconciliation, exact-deadline expiry, and stricter witnessed UTC rollover checks. All 106 unit tests pass. Persisted recovery fixture `nx7adevx6tvz1t617p9d1qnq018gbty1` deliberately introduced a one-cent isolated discrepancy and confirmed pause/cancellation/one incident/no fills. The five-class fixture `nx705j3g12c4atsjm1kx4n9he58gbqr7` produced five reconciled synthetic fills. A separately scheduled fixture completed after the initiating process exited; this was not a backend-process restart or unattended real-provider midnight test.

The owner-requested office terminal is implemented, showing actual stored prices/times/statuses with stale/missing labels and no extra provider polling. Prepared a guarded actual-provider acceptance runner and a provider-rights enquiry; the enquiry was not sent. Its blocked path was exercised without requests/orders/new reviews. Rights/display/publication, FX sessions, securities corporate actions, US-open source quality and actual-feed fills/benchmarks remain open. No model calls, paid upgrades, live orders or official experiment. See PROVIDER_REVIEW.md and PHASE_2.md.

## 15 October 2026 — Phase 2 approved, provider gates remain open

Implemented decimal multicurrency TEST accounts, double-entry postings/reconciliation, deterministic risk and next-quote paper fills, scoped fixtures, benchmarks, read-only adapters, quota reservations/scheduling and Paper lab. Scripted five-class fills and concurrent retries pass. Provider incident: Kraken public Time/trades reported approximately +3,600 seconds vs Windows UTC and independent clock; rejected, not corrected. Owner is creating a free Twelve Data account; key/entitlements still pending. No model calls, live broker APIs, paid subscriptions or official run. See PHASE_2.md for evidence and remaining gates.

## 15 October 2026 — GitHub fork

Owner selected Adamskib23. Verified the stored Git Credential Manager identity without displaying credentials, created Adamskib23/AI_Trading_Office as an upstream fork, and added it as origin. Published phase-1-office for review; upstream remains separately configured. No deployment, model calls, trading, merge into main or Phase 2 implementation was performed.

## 15 October 2026 — Phase 1 approved

Owner confirmed AI Town works and authorised the fork/Phase 1. Created local phase-1-office branch; preserved upstream as upstream remote. Built a separate persistent five-avatar office, original SVG furniture, CEO setup UI, owner-token controls, legacy write guards, 14-instrument registry, reference calendars and model-call lock. Original world/history retained. Verified unit, backend integration and browser checks; fixed Pixi teardown and resize bugs found during browser testing. No inference, quotes integration, trading or research executed. GitHub fork awaits owner destination and connected GitHub account. See PHASE_1.md for evidence and limitations.

## 14 October 2026 — Phase 0

Read all three supplied v0.4 files and preserved the architecture/kickoff in the checkout. Cloned upstream at recorded SHA; no owner GitHub fork or public deployment created. Installed locked dependencies with lifecycle scripts disabled; build and 53 tests pass; lint has 96 warnings. Recorded auth, idle-pause, memory/retention and advisory findings. Audited multi-market provider documentation and read-only Kraken pair metadata. Created local Convex deployment, initialised zero-agent upstream map, verified human movement and HTTP frontend availability. No paid or local model inference, financial orders, subscriptions or experiment occurred. Browser rendering, social AI baseline and credentialed provider/rights checks remain open. See PHASE_0_AUDIT, PHASE_0_RUNTIME, PROVIDER_DECISIONS and WINDOWS_SETUP.
