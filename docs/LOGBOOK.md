# Development logbook

## 15 October 2026 — Phase 2 approved, provider gates remain open

Implemented decimal multicurrency TEST accounts, double-entry postings/reconciliation, deterministic risk and next-quote paper fills, scoped fixtures, benchmarks, read-only adapters, quota reservations/scheduling and Paper lab. Scripted five-class fills and concurrent retries pass. Provider incident: Kraken public Time/trades reported approximately +3,600 seconds vs Windows UTC and independent clock; rejected, not corrected. Owner is creating a free Twelve Data account; key/entitlements still pending. No model calls, live broker APIs, paid subscriptions or official run. See PHASE_2.md for evidence and remaining gates.

## 15 October 2026 — GitHub fork

Owner selected Adamskib23. Verified the stored Git Credential Manager identity without displaying credentials, created Adamskib23/AI_Trading_Office as an upstream fork, and added it as origin. Published phase-1-office for review; upstream remains separately configured. No deployment, model calls, trading, merge into main or Phase 2 implementation was performed.

## 15 October 2026 — Phase 1 approved

Owner confirmed AI Town works and authorised the fork/Phase 1. Created local phase-1-office branch; preserved upstream as upstream remote. Built a separate persistent five-avatar office, original SVG furniture, CEO setup UI, owner-token controls, legacy write guards, 14-instrument registry, reference calendars and model-call lock. Original world/history retained. Verified unit, backend integration and browser checks; fixed Pixi teardown and resize bugs found during browser testing. No inference, quotes integration, trading or research executed. GitHub fork awaits owner destination and connected GitHub account. See PHASE_1.md for evidence and limitations.

## 14 October 2026 — Phase 0

Read all three supplied v0.4 files and preserved the architecture/kickoff in the checkout. Cloned upstream at recorded SHA; no owner GitHub fork or public deployment created. Installed locked dependencies with lifecycle scripts disabled; build and 53 tests pass; lint has 96 warnings. Recorded auth, idle-pause, memory/retention and advisory findings. Audited multi-market provider documentation and read-only Kraken pair metadata. Created local Convex deployment, initialised zero-agent upstream map, verified human movement and HTTP frontend availability. No paid or local model inference, financial orders, subscriptions or experiment occurred. Browser rendering, social AI baseline and credentialed provider/rights checks remain open. See PHASE_0_AUDIT, PHASE_0_RUNTIME, PROVIDER_DECISIONS and WINDOWS_SETUP.
