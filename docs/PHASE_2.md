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

- **Twelve Data:** quote and 1h raw candle adapters implemented, credentials not yet supplied. The owner is creating a free account. The quote's `timestamp` is a candle-opening clock; use documented `last_quote_at` as a conservative minute-resolution source clock. It is not a tick/NBBO feed. Source mode stays indicative until a dated review supports another mode. Incomplete candles are removed. No stock, ETF or FX entitlement is claimed verified.
- **Kraken:** public SystemStatus, Time, Trades and OHLC only. Symbol aliases are checked; real trade timestamps are retained; the uncommitted last candle is excluded. During this session the public Time endpoint reported `2026-10-15T11:37:21Z` while Windows UTC was `2026-10-15T10:37:21.956Z` and the independent clock agreed with Windows. Trade timestamps showed the same roughly 3,600-second lead. Quotes were rejected; the adapter now explicitly reports PROVIDER_CLOCK_SKEW when server time differs by more than five seconds. No timezone subtraction or fabricated repair is applied. Later symbols were deferred by provider cooldown. Actual crypto feed validation is therefore incomplete.
- Successful retrieval would still leave data/publication rights unverified. Dated owner reviews require real quote and candle evidence first. FX provider holidays/maintenance still need a provider-specific calendar review; the existing 24/5 reference is not a claim of verified provider hours.

Provider requests use server-only secrets. Quota reservations are transactional: Twelve Data 8 credits/minute and 800/day (2 credits per quote/candle pair); Kraken is capped locally at 30 requests/minute and 10,000/day (four reserved per health/time/quote/candle attempt). Errors retain consumed reservations, impose a one-minute provider cooldown, and never retry in an unbounded loop. Active provider TESTs share hourly polling with staggered scheduled reservations; a proposed accepted order schedules a later refresh. No active provider TEST means no scheduled feed polling. Missing credentials produce explicit events. Subscriptions, account upgrades and read-only feed fees are not authorised implicitly.

## Setup: owner’s next action

1. Create a free [Twelve Data account](https://twelvedata.com/pricing). Do not paste the key in chat or select a paid tier.
2. With local Convex running, open PowerShell in the ai-town checkout and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-market-key.ps1
```

The hidden prompt pipes the key to `TWELVE_DATA_API_KEY` in the local backend; it does not write a frontend key or command-line/history value. It does not change system execution policy.

**Preferred file-based alternative:** put `TWELVE_DATA_API_KEY=your_key` in the Git-ignored `.secrets.env` at checkout root, then run `node scripts/import-secrets.mjs`. Use the blank `.secrets.env.example` template. Keep `.env.local` for Convex-generated URLs. Future-phase keys can be stored in the secrets file but the importer currently loads only the Phase 2 data key; no model/provider requests are made by importing.

3. Open **Paper lab**, unlock CEO controls, and refresh one stock, one broad ETF, one commodity ETF and FX while their sessions are open. Record actual source timestamps, closed raw candles, entitlement and licence evidence. Inspect clock errors rather than weakening validation.
4. Complete dated reviews for rights, source mode, FX hours and corporate-action windows. `scripts/review-feed.mjs` accepts an ignored local JSON file and calls the authenticated review endpoint. Do not attest to evidence that has not been checked. Refresh again after a review before testing orders.
5. Create provider TEST accounts and submit scripted orders through `scripts/paper-order.mjs .office/order.json`. Order JSON contains only `runId` and a `proposal` object (agentId, cycleId, proposalIndex, instrumentId, action and quantity or currency conversion fields). No prices, balances or fills are accepted from the script. Review acceptance/rejection and later fills in the lab.

Fixture button or `node scripts/verify-paper.mjs` is available immediately without a market key. It is explicitly synthetic and is not a substitute for step 3–5.

## Verification and remaining exit gates

- 11 Jest suites / 93 tests pass: decimal settlement, BUY/SELL, both FX directions/JPY, fees and replay, precision/funds/shorts/notional/concentration/drawdown/daily-limit/pause checks, stale/future/delayed/outage/wrong-currency/fixture-isolation cases, session and corporate-action guards, provider parser fixtures, unfinished candles and passive benchmark timing. The count excludes duplicated test imports.
- Local Convex scenario: exactly five multi-class fixture fills after later quotes, no same-quote fills, no duplicate settlement, all five ledgers reconcile. Four concurrent duplicate requests create one rejected order; changed payload under the same key is refused. Paused provider regression has funding only.
- Installed-Chrome check: Paper lab renders, observer writes disabled, CEO fixture button works, balances/reconciliation labels appear, office tab remains functional, mobile page has no horizontal overflow, no page exceptions or failed resources.
- Production build passes. Lint has zero errors and 82 existing upstream warnings; no new-module lint warnings remain. Model calls remain locked by OFFICE_PHASE 1 or 2 (local environment now set to 2). No OpenAI key was requested.
- **Open gates:** connect/verify Twelve Data; resolve or replace the rejected Kraken source without reducing market scope; verify real closed candles/quotes for every selected symbol, rights, FX calendars and corporate actions; demonstrate real-provider stock + broad ETF + commodity ETF + cash FX + crypto paper fills; verify unattended recovery/day rollover and source-driven benchmarks with actual data. Deterministic source fixtures and a future-time feed rejection do not satisfy these real-provider gates.

Phase 2 remains active. Do not begin Phase 3 or label the system official-trial-ready until those gates pass and the owner approves the next phase.

Primary documentation reviewed: [Twelve Data quote](https://twelvedata.com/docs/llms/market-data/quote.md), [raw time series](https://twelvedata.com/docs/llms/market-data/time-series.md), [Kraken public trades](https://docs.kraken.com/api-reference/market-data/get-recent-trades), [Kraken OHLC](https://docs.kraken.com/api-reference/market-data/get-ohlc-data), [decimal.js](https://mikemcl.github.io/decimal.js/).
