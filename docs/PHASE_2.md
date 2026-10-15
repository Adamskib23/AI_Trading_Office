# Phase 2 — deterministic multi-asset paper infrastructure

Authorised by owner on 15 October 2026. **Status: implementation and scripted validation delivered; real-provider acceptance remains incomplete. Phase 3 is not authorised.** No AI inference, web research, real accounts or broker order APIs were used.

## Implemented architecture

The existing office/Convex stack remains. New financial tables sit outside the visual world: TEST runs, five accounts per run, idempotent orders, fills, immutable double-entry postings, valuation marks, benchmarks, source quotes, raw closed candles, capability reviews, quota counters and feed incidents. Visual idle-pause does not stop these independent scheduled jobs.

`convex/trading/engine.ts` is a pure deterministic risk/execution/valuation implementation. `convex/paper.ts` persists transactions atomically. `marketData.ts` is the read-only feed orchestrator; provider requests use fixed hosts and fixed registry symbols. `paperFixtures.ts` runs a clearly synthetic scripted scenario with its own quote scope. Public owner-authenticated wrappers allow development scripts to submit proposals; future trusted agent jobs can call the same internal submit path without per-trade owner approval.

All financial decimal inputs are validated strings. decimal.js uses 40 significant digits, explicit currency rounding and no binary floating-point ledger authority. USD/EUR/GBP have two cash decimals; JPY has none. US stock/ETF quantities explicitly simulate six fractional decimals; spot crypto uses eight. This is a simulation assumption, not an assertion that a real broker supports fractional instruments. Market prices are not supplied by agents or order files.

## Execution and risk rules

1. Validate the account/run, selected instrument, verified quote/candle capabilities, data rights, session review and corporate-action window. Reconcile the ledger before accepting a proposal.
2. Enforce calendar state, healthy timely source data, source/mode identity, non-future timestamps and a 120-second open-session freshness limit. Delayed/indicative data is ineligible for execution. Provider scope cannot contain fixture data.
3. Validate typed BUY/SELL/CONVERT_CURRENCY, quantity/currency precision, actual owned funds/positions and USD valuation. FX is strictly an exchange of owned currency cash, never a leveraged position.
4. Enforce $10–$200 execution notional, 30% single-asset and 60% asset-class exposure, six filled orders per employee per UTC day, and pause thresholds of 5% day loss / 15% initial-capital loss. Pending proposals reserve daily trade capacity; funds/exposure are rechecked at fill. Class treatment: stock, all ETFs (including commodity proxies), non-USD FX cash, spot crypto. USD cash is excluded from exposure caps.
5. Persist ACCEPTED or an explicit REJECTED reason. Key `(runId, agentId, cycleId, proposalIndex)` is retry-safe; changed content under the same key fails with IDEMPOTENCY_CONFLICT.
6. An accepted order cannot fill on its observed quote: both sourceTimestamp and retrievedAt of the fill quote must be strictly later than acceptedAt. The next subsequent source snapshot triggers revalidation and atomic account/ledger/fill/order writes. Pending orders expire after three minutes. Any failed check leaves no fill posting.
7. Public controls support per-run pause, per-employee pause and pause-all-provider-tests. They cancel affected pending proposals; avatar/office pause remains a separate visual control. No official run/start endpoint exists.

Retry, concurrent-transaction and duplicate-ingestion safety rely on Convex transactional reads/writes plus application idempotency; no external broker execution needs exactly-once delivery.

## Pricing and accounting assumptions (paper-v1)

| Class | Full synthetic spread when bid/ask absent | Adverse slippage per side | Commission |
| --- | --- | --- | --- |
| US stocks / ETFs | 10 bps | 5 bps | 5 bps |
| FX cash conversion | 10 bps | 2 bps | 5 bps of source cash |
| Spot crypto | 20 bps | 10 bps | 10 bps |

Actual bid/ask, if present, supply the execution side rather than adding another synthetic spread; the observed half-spread is recorded separately. Otherwise last plus/minus half the configured spread is used. Prices round conservatively to ten decimals, costs round up to currency precision, proceeds round down, and foreign currency received rounds down. Fees carry their actual currency; spread/slippage cost fields are USD equivalents and are informational components already embedded in price, not extra ledger deductions. No fee is charged for mere USD valuation.

Every asset/currency posting has an equal opposite clearing, fees or funding posting. Replaying only agent-side postings must reproduce cached holdings exactly; per-asset totals across all counterparties must be zero. Failure blocks acceptance/fills and pauses the affected account. Closed-market marks retain their source timestamp, with a four-day maximum last-mark age; missing/uncertain components make equity partially unpriced, never zero-filled or invented.

Corporate actions currently use a **block policy**, not automatic split/dividend processing. A dated review may clear a security/ETF for at most seven days. Without clearance, orders reject; existing affected holdings are unpriced. Verify every enabled security's actual window before clearing it. No adjusted candle masquerades as a raw quote; Twelve Data requests `adjust=none`.

UTC risk baseline: initial funding is the creation-day baseline. A rollover requires a fully priced mark witnessed within five minutes of midnight, using the greater of the prior mark and current equity conservatively. Missing midnight evidence blocks new orders with UTC_DAY_BASELINE_REQUIRED rather than silently resetting after losses. TEST rollover and eventual unattended readiness need additional real-provider/clock validation before official use.

## Reference portfolios

Each TEST has a $1,000 USD cash reference and a provisional 25% SPY / 25% EUR cash / 25% BTC / 25% GLD passive basket. Each sleeve waits independently for an eligible source quote after run creation. Closed exchanges stay cash until available. The same quote checks, spread/slippage/fee schedules and fractional precision apply. Two cents per sleeve remain reserved for conservative cash rounding; residual cash is included in equity. Benchmarks are references, not employees subject to the six-trade/drawdown policy. Acquisition quote IDs, quantities, fees and times are stored. Freeze the final benchmark protocol before the official trial.

## Read-only providers and current evidence

- **Twelve Data:** key imported from ignored `.secrets.env`. All eight US symbols returned quotes stamped `2026-10-14T19:59:00Z` and 48 closed raw hourly candles before the next US regular session. EUR/USD returned source `2026-10-15T12:36:00Z`; GBP/USD and USD/JPY returned `12:38:00Z`, each with 47 closed candles after excluding the current bar. Their initial clock rejections resolved after Windows synchronization. Source mode remains indicative pending review. The quote's `timestamp` describes a candle opening; the adapter uses `last_quote_at` as a conservative minute-resolution source clock. No tick/NBBO or execution entitlement is claimed. Reproduce selected symbols with `scripts/verify-twelve-feeds.mjs`; requests consume quota and stop at the first failure/quota gate.
- **Kraken:** public SystemStatus, Time, Trades and OHLC only. After synchronization, BTC, ETH and SOL returned actual trade clocks `2026-10-15T12:36:48.757Z`, `12:36:49.677Z` and `12:36:50.895Z`, each with 48 closed raw candles. Observed quote ages were one to three seconds. Public connectivity and timestamp/candle parsing pass; use/publication rights are still unverified. The five-second clock-skew rejection remains intact.
- **Clock incident resolved:** the local UTC clock was approximately one hour behind Kraken and independent Microsoft/Cloudflare HTTP clocks. Windows Time was stopped. The owner used Sync now; all clocks then agreed within about one second, and FX/crypto ingestion passed without modifying source timestamps. Earlier “independent clock” evidence followed local time and did not establish a provider fault. Historical failed events remain. Feed errors now preserve specific validation codes with numeric clock diagnostics, rather than raw upstream text. `node scripts/check-market-clock.mjs` is a read-only diagnostic.
- Successful retrieval would still leave data/publication rights unverified. Dated owner reviews require real quote and candle evidence first. FX provider holidays/maintenance still need a provider-specific calendar review; the existing 24/5 reference is not a claim of verified provider hours.

Provider requests use server-only secrets. Quota reservations are transactional: Twelve Data 8 credits/minute and 800/day (2 credits per quote/candle pair); Kraken is capped locally at 30 requests/minute and 10,000/day (four reserved per health/time/quote/candle attempt). Errors retain consumed reservations, impose a one-minute provider cooldown, and never retry in an unbounded loop. Active provider TESTs share hourly polling with staggered scheduled reservations; a proposed accepted order schedules a later refresh. No active provider TEST means no scheduled feed polling. Missing credentials produce explicit events. Subscriptions, account upgrades and read-only feed fees are not authorised implicitly.

## Setup and remaining reviews

1. The owner has created a free Twelve Data account and connected its key. The following commands are retained for reinstall/recovery; no paid tier is authorised.
2. With local Convex running, open PowerShell in the ai-town checkout and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-market-key.ps1
```

The hidden prompt pipes the key to `TWELVE_DATA_API_KEY` in the local backend; it does not write a frontend key or command-line/history value. It does not change system execution policy.

**Preferred file-based alternative:** put `TWELVE_DATA_API_KEY=your_key` in the Git-ignored `.secrets.env` at checkout root, then run `node scripts/import-secrets.mjs`. Use the blank `.secrets.env.example` template. Keep `.env.local` for Convex-generated URLs. Future-phase keys can be stored in the secrets file but the importer currently loads only the Phase 2 data key; no model/provider requests are made by importing.

3. All symbols have quote/candle retrieval evidence. Repeat US-symbol checks during an open regular session, measure source freshness and complete the rights/session/corporate-action reviews. See [PROVIDER_REVIEW.md](PROVIDER_REVIEW.md) for the exact evidence and a prepared, unsent provider enquiry. Inspect clock errors rather than weakening validation.
4. Complete dated reviews for rights, source mode, FX hours and corporate-action windows. `scripts/review-feed.mjs` accepts an ignored local JSON file and calls the authenticated review endpoint. Do not attest to evidence that has not been checked. Refresh again after a review before testing orders.
5. Create provider TEST accounts and submit scripted orders through `scripts/paper-order.mjs .office/order.json`. Order JSON contains only `runId` and a `proposal` object (agentId, cycleId, proposalIndex, instrumentId, action and quantity or currency conversion fields). No prices, balances or fills are accepted from the script. Review acceptance/rejection and later fills in the lab.

Fixture button or `node scripts/verify-paper.mjs` is available immediately without a market key. It is explicitly synthetic and is not a substitute for step 3–5.

## Verification and remaining exit gates

### Office market terminal

The front of the office now has a clickable Pixi market screen with a decorative pulsing indicator (disabled for reduced-motion preference). The keyboard-accessible Open market terminal button opens the same native dialog. The terminal subscribes to existing provider-scope Convex data for all 14 registered instruments, displaying last price, currency, UTC source time, freshness, provider/mode and latest feed result. It does not fetch providers or create trades. Missing data remains blank, older-than-120-second quotes are labelled STALE, and RECENT describes age only. Existing provider polling and quota rules are unchanged; this is a reactive feed viewer, not a streaming tick subscription. Escape and the close button restore access to the office. No new framework, backend schema or approved trading policy changes are required.

Validation: production build and targeted component lint pass; browser checks cover all 14 rows, closing/reopening, Escape, mobile overflow and absence of page exceptions. Real-time price coverage remains subject to the provider gates below.

- 12 Jest suites / 106 tests pass: existing accounting/risk/calendar coverage plus UTC rollover after restart, missing/stale/future/unpriced midnight evidence, preservation of drawdown, synchronized/skewed provider clocks, outage recovery and idempotent benchmark acquisition across weekend reopening.
- Local Convex scenario: exactly five multi-class fixture fills after later quotes, no same-quote fills, no duplicate settlement, all five ledgers reconcile. Four concurrent duplicate requests create one rejected order; changed payload under the same key is refused. Paused provider regression has funding only.
- Installed-Chrome check: Paper lab renders, observer writes disabled, CEO fixture button works, balances/reconciliation labels appear, office tab remains functional, mobile page has no horizontal overflow, no page exceptions or failed resources.
- Production build passes. Lint has zero errors and 82 existing upstream warnings; no new-module lint warnings remain. Model calls remain locked by OFFICE_PHASE 1 or 2 (local environment now set to 2). No OpenAI key was requested.
- Persisted recovery fixture: exact-deadline expiry and retry pass. A deliberately isolated one-cent cached-balance discrepancy pauses its account, cancels a pending order without a later quote, records one incident under repeated checks, and produces zero fills. Financial sweeps now reconcile provider accounts every minute independently of the browser. The intentionally corrupted fixture is retained and labelled; it is not repaired or mixed with provider accounts.
- A Convex-scheduled recovery fixture completed successfully after the initiating Node process exited, without a browser or provider calls. This proves that scheduled transaction path; it does not prove backend-process restart or a full unattended soak. Use `scripts/verify-recovery.mjs --schedule` then `--scheduled-status`.
- `scripts/verify-provider-acceptance.mjs` reports exact per-symbol gates without network-provider requests. Its `--run` path currently refuses rights/session/source/corporate-action/closed-market blockers before creating a run. Once evidence genuinely passes, it can drive the five-class actual-feed acceptance test and always pause its TEST on exit. The successful actual-feed path remains unexecuted.
- **Open gates:** verify US open-session freshness/source mode and provider rights, FX sessions and securities corporate actions; demonstrate actual-feed stock + broad ETF + commodity ETF + cash FX + crypto paper fills and benchmarks; verify actual-provider restart/day rollover. All-symbol retrieval and clock repair are complete; synthetic recovery does not replace these remaining gates. Full 24–72-hour agent/research soak remains Phase 6.

Phase 2 remains active. Do not begin Phase 3 or label the system official-trial-ready until those gates pass and the owner approves the next phase.

Primary documentation reviewed: [Twelve Data quote](https://twelvedata.com/docs/llms/market-data/quote.md), [raw time series](https://twelvedata.com/docs/llms/market-data/time-series.md), [Kraken public trades](https://docs.kraken.com/api-reference/market-data/get-recent-trades), [Kraken OHLC](https://docs.kraken.com/api-reference/market-data/get-ohlc-data), [decimal.js](https://mikemcl.github.io/decimal.js/).
