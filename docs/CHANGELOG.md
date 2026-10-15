# Project changelog

## 15 October 2026 — actual-feed acceptance and shared bounded refresh

- Passed automatic actual-feed stock, broad ETF, commodity ETF, FX cash conversion and crypto paper fills with five reconciled accounts and four benchmark sleeves.
- Fixed the observed GLD follow-up gap using shared per-instrument refresh slots, generation-based coalescing and expiry/deadline-bounded retries. First-run manual refresh is disclosed; repeat acceptance needed no intervention.
- Verified filled portfolios, immutable fills/source clocks and benchmark acquisitions across an actual backend restart.
- Started bounded real-midnight observation with automatic check/stop at 16 October 00:06 UTC / 01:06 London. Result remains pending; no Phase 3/official start.

## 15 October 2026 — source evidence and bounded midnight verification

- Scoped owner-reported Kraken internal-use review, FX session/source evidence, bounded representative-securities corporate-action review and actual local backend restart evidence.
- Added midnight polling for open held assets/foreign cash, bounded day-check scheduling, persisted results and automatic TEST deadlines enforced before cron.
- Captured immutable fill/benchmark source clocks; actual-feed acceptance checks verify later-source execution.
- Extended provider timeout through response-body parsing. Updated recovery/source checks and added 13-suite / 112-test coverage. Real-source execution/midnight results are tracked separately from prepared checks.

## 15 October 2026 — owner-scoped paper permission and display control

- Recorded the owner's temporary Twelve Data internal paper-use permission for its 11 instruments; preserved technical gates and Kraken's unreviewed status.
- Terminal prices default off, with an audited, persisted CEO-only toggle and backend omission of disabled price fields. Feed timing/health remains visible.
- Added a local integration check covering authorization, omitted prices and cross-client persistence; it always restores the off setting.

## 15 October 2026 — terminal and Phase 2 validation hardening (pre-trial)

- Clickable animated office market screen and accessible read-only terminal for all 14 symbols, with source clocks and stale/missing/mode labels. No new framework or implicit provider polling.
- Diagnosed local UTC clock drift; owner synchronization restored FX and crypto ingestion without weakening timestamp checks. All 14 symbols returned quote/candle evidence; US-open checks remain pending.
- Numeric-only feed-failure diagnostics, preserving specific validation codes and avoiding raw upstream text.
- Periodic provider ledger reconciliation, persisted incidents, pending-order cancellation on mismatch, exact expiry boundary and validated UTC rollover witnesses.
- Added controlled-clock/recovery/benchmark tests, persisted fault-injection fixture, scheduled fixture verification and guarded provider-acceptance runbook/runner.
- Actual-feed fill acceptance, rights/session/corporate-action reviews and actual-provider restart/day-rollover remain incomplete. No Phase 3 activity, model calls, data upgrades, public publication or official run.

## 15 October 2026 — local secrets-file workflow

- Added ignored `.secrets.env` and backup patterns, with a blank tracked example.
- Added local-only stdin importer; validates Git protection and deployment selection, rejects VITE_ names, imports only the approved Phase 2 data key and keeps future model keys disconnected.
- Preserved Convex-generated `.env.local` and the existing hidden-prompt alternative. No keys committed or model calls enabled.

## 15 October 2026 — Phase 2 paper engine (pre-trial, source validation pending)

- Decimal-safe four-currency accounts, fractional paper positions, atomic next-quote fills, double-entry postings and replay reconciliation.
- Risk caps, timestamps/session/rights/corporate-action gates, idempotency, per-agent/global pauses, expiry and independent financial scheduling.
- Isolated synthetic multi-class tests, provisional passive benchmarks, read-only Twelve Data/Kraken adapters and quota guards.
- Paper lab and hidden local market-key setup. Real feed acceptance remains incomplete: Twelve Data account pending; Kraken clock-skew rejected.
- No AI trading, research, paid data subscription, live trading or official experiment.

## 15 October 2026 — Phase 1 foundations (pre-trial)

- Separate office world with five inactive employee avatars, assigned desks and original SVG office furniture; preserves baseline history and upstream movement/rendering.
- CEO setup dashboard, instrument selections and real owner-action audit records.
- Server-validated local owner access, office-specific legacy mutation guards and an explicit inference lock.
- Fourteen proposed multi-asset instruments, all unverified; versioned US session calendar and conservative FX/crypto reference states.
- Windows local launcher; calendar/access/reachability/inference unit checks, local backend checks and browser verification.
- No market integration, broker, inference, research, paper orders or official run started. Owner GitHub fork created at Adamskib23/AI_Trading_Office; Phase 1 is published on phase-1-office for review.

## 14 October 2026 — Phase 0 baseline (pre-trial)

- Pinned AI Town at 8e05997f2409275669c8344b84a51692e83f3f33; installed locked dependencies; recorded source, environment, dependency-advisory and provider feasibility audits.
- Local zero-agent baseline and movement verified; owner subsequently confirmed browser operation.
