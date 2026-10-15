# Phase 2 provider review — 15 October 2026

## What is established

All 14 starter symbols returned quotes and closed raw hourly candles through the configured local backend. That establishes retrieval, not a subscription licence, an executable session, or continuously fresh data. The free Twelve Data account is connected; no upgrade was bought. Kraken uses public endpoints without an account or trade credentials.

The initial FX/crypto failures were caused by the local UTC clock being approximately one hour behind the external clocks. Before synchronization, Kraken, Microsoft and Cloudflare agreed with one another. Windows Time was stopped. After the owner used Windows Sync now, external clocks agreed with local UTC within about one second and all three crypto pairs plus FX passed. Earlier references to an independent clock used a clock reporting the same local time; that was insufficient evidence to attribute the fault to Kraken. Original error events remain intact. No source timestamp was rewritten.

## Rights and session evidence still needed

### Owner-reported temporary permission — 15 October 2026

The owner reports that Twelve Data said the current paper use is okay for now and that an upgrade can follow later. The owner clarified that Kraken has not been contacted and requested terminal display be switched off and made toggleable. Record Twelve Data execution rights for the current internal paper evaluation on that owner-reported basis, not as a directly inspected provider response or a permanent/publication grant. Kraken rights remain unreviewed. Terminal prices default off; only authenticated CEO controls can change the persisted setting, with an audit event. The terminal's dedicated query omits price fields while off, retaining timing/health metadata. No public display, publication, subscription upgrade or real-money trading is authorised.

The corresponding Twelve Data reviews preserve existing unverified session/source/corporate-action fields. Those are separate technical checks and remain unchanged. Turning terminal prices on later is a display setting, not evidence that a provider granted display or publication rights; review the relevant terms before using it.

### Subsequent Kraken and technical review — 15 October 2026

The owner subsequently reviewed Kraken's permissions and confirmed internal use without redistribution. Recorded that owner-reported scope for BTC/USD, ETH/USD and SOL/USD, preserving the other capability values. No correspondence with Kraken, public display or redistribution permission is claimed. Terminal prices remain off.

The [Phase 2 acceptance evidence](PHASE_2_ACCEPTANCE.md) now records the technical review separately: Twelve Data's documented continuous aggregate FX feed, the retained conservative New York weekday conversion window, fresh weekday FX observations, US regular-session calendar and a bounded AAPL/SPY/GLD corporate-action review ending 16 October at 20:00 UTC. Open-session source and execution results are recorded only after they run. Other securities retain separate review gates.

| Concern | Current evidence | Required before recording a positive review |
| --- | --- | --- |
| Twelve Data internal simulation | [Basic pricing](https://twelvedata.com/pricing) lists internal non-display usage | Confirm the actual account tier and permission for this specific five-agent, paper-only evaluation, retention and audit history |
| Private terminal display | Pricing distinguishes non-display Basic from internal-display tiers; [terms](https://twelvedata.com/terms) make display conditional on the subscription | Confirm whether a single-owner local terminal and portfolio/fill screens are permitted; do not assume a working endpoint grants display rights |
| YouTube / public screenshots / exports | Terms distinguish internal use from redistribution and external display | Written permission or clearly applicable grant, attribution requirements, publication delay and allowed fields; do not publish raw provider data by default |
| FX sessions | [Provider Forex page](https://twelvedata.com/exchanges/physical_currency) currently advertises 24/7 aggregate availability, while the approved simulator uses a conservative New York weekend closure | Clarify the aggregate's actual pricing hours, weekend indications, holiday/maintenance handling and what last_quote_at represents. The generic page does not certify tradable OTC sessions |
| US sessions / price mode | Existing versioned NYSE regular-session calendar; all eight symbols returned the previous close while US markets were closed | Open-session measurements of quote age and closed candles, venue/source coverage and actual live/delayed mode. Do not infer consolidated/NBBO quality |
| Securities corporate actions | The engine blocks expired/absent reviews and affected instruments | Dated authoritative issuer/exchange checks covering each enabled symbol and the exact upcoming test window, at most seven days per review; no blanket “clear” attestation |
| Kraken use / publication | [Public API](https://docs.kraken.com/api-reference/market-data/get-recent-trades) and [global terms](https://www.kraken.com/legal/global-terms) reviewed; public connectivity confirmed | Applicable permission for internal simulation, retention, local display and documentary publication; public access is not itself a redistribution grant |

The original retrieval probes recorded no positive rights/session/corporate-action attestations. The later owner-reported Twelve Data paper-use permission above supports a scoped execution-rights update only. No fees or subscription changes are authorised by this review. The approved architecture and market scope are unchanged.

## Draft enquiry for Twelve Data (prepared, not sent)

I am evaluating your free Basic account for a personal project called AI Trading Office. Five software agents will analyse AAPL, MSFT, NVDA, SPY, QQQ, GLD, SLV, USO, EUR/USD, GBP/USD and USD/JPY using shared REST quote and raw hourly candle requests. They execute only simulated trades; there are no brokerage orders, real funds or paying app users. We intend to retain timestamped source records and paper ledger evidence for a seven-day experiment.

Please confirm which current permissions cover (1) internal automated paper simulation, (2) retention of quote/candle and derived trade records, (3) a local terminal and portfolio dashboard visible only to the account owner, and (4) eventual screenshots or historical extracts in a public YouTube documentary, potentially monetised. Please specify attribution, delayed-publication conditions, retention limits, exchange agreements and any required plan. We are not authorising an upgrade.

Please also clarify the actual EUR/USD, GBP/USD and USD/JPY aggregate pricing sessions, weekend/holiday/maintenance behaviour, live versus indicative status and last_quote_at semantics. Your Forex page advertises 24/7 availability; our simulator deliberately blocks weekend conversions. Which source and latency assumptions should a paper simulator disclose?

A corresponding Kraken enquiry can describe public Time/SystemStatus/Trades/OHLC use for BTC/USD, ETH/USD and SOL/USD, with the same internal simulation, retention, local display and documentary questions. Do not create an exchange trading key.

## Runbook once evidence is available

1. `node scripts/check-market-clock.mjs` — no secrets or clock changes.
2. `node scripts/verify-provider-acceptance.mjs` — read-only report for all symbols. It does not poll providers or change reviews.
3. Record each supported dated review with `scripts/review-feed.mjs` and an ignored local JSON file. Set only fields justified by the evidence. The existing rights flag is an execution gate, not a blanket grant to publish data.
4. During an open US session, `node scripts/verify-provider-acceptance.mjs --run` will first refuse unresolved structural gates. If they pass, it refreshes the five representative feeds, rechecks freshness, creates a new provider TEST and proposes one approximately $100 paper order per employee across stock, broad ETF, commodity ETF, EUR conversion and BTC. The backend performs all risk checks and fills only on subsequent eligible quotes. The script checks five reconciled accounts and four benchmark sleeves, waits at most about 200 seconds and pauses the TEST on exit. It does not start an official run or change permissions. This successful path is prepared but has not yet run against eligible actual feeds.
5. Complete actual-provider restart/day-boundary validation. The controlled-clock tests and scheduled fixture demonstrate specific recovery properties, not a real midnight run or backend-process restart. The full 24–72-hour agent/research soak remains Phase 6.

The actual backend/supervisor restart has now been exercised with a paused provider TEST: all five funded accounts, balances, empty orders/fills and reconciliation survived. A recovery job scheduled before restart completed afterward. The real midnight check is a separate bounded provider TEST. After actual-feed acceptance passes, `node scripts/verify-day-boundary.mjs --start` resumes that verified TEST, refreshes open held assets during 23:58–00:05 UTC, and schedules a check/automatic pause at 00:06 UTC. `node scripts/verify-day-boundary.mjs --status` reads the persisted result. Pending is not a pass. Leave the Windows computer awake and local Convex running; the browser is unnecessary. No new proposals, models or research are scheduled by this check.

Latest result: the actual-feed acceptance path has passed across all five categories without manual refreshes, and the filled portfolios, orders/fills/source clocks and benchmark acquisitions survived an additional backend restart exactly. The verified TEST's real midnight check is **started**, with automatic stop/check at **01:06 London time on 16 October 2026**. Only that future rollover outcome remains pending for the representative Phase 2 acceptance path. See [PHASE_2_ACCEPTANCE.md](PHASE_2_ACCEPTANCE.md) for persisted run references, the first run's intervention and the shared-refresh correction.

Synthetic recovery checks are available now:

```powershell
node scripts/verify-recovery.mjs
node scripts/verify-recovery.mjs --schedule
# After five seconds, from a new process:
node scripts/verify-recovery.mjs --scheduled-status
```

The recovery fixture deliberately corrupts one isolated cached balance by one cent to test detection. Its completed record is retained and labelled, and should show a reconciliation incident. It never changes provider accounts or repairs ledger history.
