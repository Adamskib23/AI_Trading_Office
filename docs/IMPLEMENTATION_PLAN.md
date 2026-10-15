# Incremental implementation plan

Authority: supplied architecture v0.4. Owner approved Phase 1 on 15 October 2026 after confirming the baseline runs. Phase 2 is not yet authorised. See PHASE_1.md for implemented foundations and remaining remote-fork setup.

| Phase | Small implementation increments | Required evidence before next phase |
| --- | --- | --- |
| 0 | Pin upstream; inspect code and assets; install/build/test; controlled local baseline; provider feasibility matrix | SHA, checks, runtime status, access/rights blockers and owner checkpoint |
| 1 | Versioned five employee profiles and desks; office map using existing renderer; owner authentication/typed controls; instrument registry and calendars; experiment setup state | Exactly five avatars; movement/collision smoke check; unauthorised controls denied server-side; calendar fixtures for DST, holiday, early close and weekends; no inference |
| 2 | Read-only feed adapters/shared cache; typed timestamped snapshots; decimal multicurrency postings; deterministic risk and next-quote paper fills; benchmark marking | Scripted stock, broad ETF, commodity ETF, FX conversion and crypto trades; no negative funds/shorts; stale/closed/outage rejection; duplicate/retry/concurrent-fill protection; fee/FX reconciliation; corporate actions |
| 3 | Independent durable jobs and reservations; verify chosen model in owner's project; one agent using structured market tools; then all five; bounded memory and usage logs | Authorised model spend; browser-closed operation; restart/retry safety; one then five agents submit genuine HOLD/orders; budgets stop new inference; no research tool enabled |
| 4 | Only after Phase 3: bounded read-only research; citations and source dates; query costs; safe failures and untrusted content | Verified model/tool compatibility; stored source provenance; malicious/stale/failed research cannot change prices, policy or funds; caps and accounting pass |
| 5 | Reuse message authority; add channels, indexed search/pagination, CEO DM; Research screen; decision/trade/message deep links and genuine avatar status | Owner sees authorised complete history; agents retain correct DM scopes; contact limits prevent loops; refresh preserves threads and sources |
| 6 | Append-only event/export contracts; independent reconciliation; kill switch/alerts; protocol freeze; 24–72h TEST soak | All classes/research/comms work; session/weekend tests; budget/security/retention checks; honest replay/export/report; trial remains locked until gates pass |
| 7 | Owner starts fresh immutable 168-hour OFFICIAL experiment; scheduled expiry and exports | $1,000 USD per employee; exact UTC start/end; no new proposals/fills after expiry; remaining holdings honestly marked with timestamps; final evidence bundle |

## Decisions to settle at their gates

- Phase 0/2: verify free-tier instrument entitlements, quote timestamps and display/non-display/YouTube rights. Select fallbacks without silently changing the multi-asset scope or purchasing tiers.
- Phase 1: identify owner auth integration; do not blindly revert an old upstream auth commit. Decide office assets only after checking their individual licences.
- Phase 2: preregister quantity precision, synthetic spread/fee/slippage, FX cash conventions, corporate-action handling, exact calendars and benchmark acquisition rules.
- Phase 3: verify model availability/pricing rather than assuming the candidate in the handoff exists. Obtain explicit permission for billable setup/test calls before connecting a project key.
- Phase 6: decide hosting plan and retention/export storage; document costs separate from model allowance.

Keep changes small. Retain upstream framework and engine; add financial jobs in Convex domain tables independent of visual simulation. Explain material architectural decisions before implementation. Never use brokerage execution APIs. Do not enable research before trading agents work. Stop at each owner's phase checkpoint.
