# Phase 0 market-data feasibility and provisional decisions

Reviewed 14 October 2026. This is a feasibility audit, not an integration or completed entitlement certification. No subscriptions purchased; no account secrets requested. Official start remains gated on actual per-symbol quotes/candles, timestamps, sessions and data rights.

**Latest Phase 2 update, 15 October:** the free Twelve Data key is connected and all 14 starter symbols have actual quote and closed-candle retrieval evidence. The initial FX/crypto failures were traced to local UTC being one hour behind external clocks; the owner synchronized Windows, after which FX and all three Kraken pairs passed. Source timestamps were never adjusted. US symbols currently have previous-session closes; open-session freshness, rights, sessions, corporate actions and actual-feed fill acceptance remain open. See [PHASE_2.md](PHASE_2.md) and [provider review/evidence runbook](PROVIDER_REVIEW.md). The original Phase 0 matrix below is historical; its Pending entries are superseded for retrieval only by this update, not for execution or publication rights.

## Provisional selection

Evaluate **Twelve Data Free for US securities/ETFs and FX**, plus **Kraken public spot data for crypto**. Alpaca Basic/IEX is a securities fallback; OANDA practice is an FX fallback if eligible. These candidates follow v0.4. No provider is approved for official use yet. Direct public Kraken endpoints may avoid introducing CCXT for three pairs; decide adapter details in Phase 2.

| Canonical proposed symbol | Primary candidate / provider symbol | Fallback | Session | Verification state |
| --- | --- | --- | --- | --- |
| AAPL | Twelve Data / AAPL | Alpaca IEX / AAPL | US equity calendar, NY timezone | Credentialed quote/history and rights pending |
| MSFT | Twelve Data / MSFT | Alpaca IEX / MSFT | US equity calendar | Pending |
| NVDA | Twelve Data / NVDA | Alpaca IEX / NVDA | US equity calendar | Pending |
| SPY | Twelve Data / SPY | Alpaca IEX / SPY | US equity calendar | Pending |
| QQQ | Twelve Data / QQQ | Alpaca IEX / QQQ | US equity calendar | Pending |
| GLD | Twelve Data / GLD | Alpaca IEX / GLD | US equity calendar | Pending; commodity exposure through ETF |
| SLV | Twelve Data / SLV | Alpaca IEX / SLV | US equity calendar | Pending; commodity exposure through ETF |
| USO | Twelve Data / USO | Alpaca IEX / USO | US equity calendar | Pending; oil exposure through ETF, no futures orders |
| EUR/USD | Twelve Data / EUR/USD | OANDA practice / EUR_USD | FX roughly 24/5, provider closures verified separately | Pending; cash conversion only |
| GBP/USD | Twelve Data / GBP/USD | OANDA practice / GBP_USD | FX roughly 24/5 | Pending |
| USD/JPY | Twelve Data / USD/JPY | OANDA practice / USD_JPY | FX roughly 24/5 | Pending |
| BTC/USD | Kraken / XXBTZUSD (alt XBTUSD; display XBT/USD) | Twelve Data candidate | Spot 24/7 except outages | Public AssetPairs verified online; quote/candle freshness still pending |
| ETH/USD | Kraken / XETHZUSD (alt ETHUSD; display ETH/USD) | Twelve Data candidate | Spot 24/7 except outages | Public AssetPairs verified online; quote/candle freshness pending |
| SOL/USD | Kraken / SOLUSD | Twelve Data candidate | Spot 24/7 except outages | Public AssetPairs verified online; quote/candle freshness pending |

This full 14-symbol list is a target, not an enabled universe. Minimum required proof includes a stock, broad ETF, commodity ETF, FX conversion and crypto. No class may disappear because an account fails verification. A seven-day trial's actual dates are not yet chosen; holidays/DST, dividends, splits and upcoming maintenance must be checked again against its exact window.

## Provider evidence, limits and rights

### Twelve Data

[Official pricing](https://twelvedata.com/pricing) advertises Free at $0, 8 API credits per minute / 800 per day, real-time US equities/ETFs, forex and crypto, and internal non-display usage. Credits depend on endpoint weight and symbol count; batching is not free quota multiplication. Trial WebSocket access is not an assumed persistent production feed. Paid Grow is advertised from $79/month billed monthly; no upgrade is authorised.

Candidate REST endpoints: `/quote`, `/time_series`, instrument reference lists. Actual exchange source, entitlement for each symbol, returned timestamp/timezone, delay, bid/ask and historical scope must be measured with an account. An automated internal agent and owner-visible price display/YouTube redistribution need distinct rights review. Marketing coverage does not establish a redistributable consolidated quote licence.

### Alpaca

[Official market-data plans](https://docs.alpaca.markets/us/docs/about-market-data-api): Basic is free, covers US stocks/ETFs with real-time IEX only, 30 WebSocket symbols and 200 historical calls/minute; the plan lists a restriction on the latest 15 minutes of historical data. Algo Trader Plus is $99/month. Verify feed-specific historical access before relying on fresh bars. IEX is venue-specific, not consolidated SIP/NBBO. Candidate data routes: `/v2/stocks/quotes/latest`, `/v2/stocks/bars`, explicitly selecting authorised feed. Account authentication is needed. Use data endpoints exclusively; broker order endpoints are outside scope. Confirm credential permissions and data display/publication rights before adoption.

### OANDA practice

[Official development guide](https://developer.oanda.com/rest-live-v20/development-guide/) documents practice REST/stream hosts and token authentication, 120 REST requests/sec, 20 active streams and at most two new connections/sec. Candidate price route is `/v3/accounts/{accountID}/pricing`; candles use the instrument candle route. Practice-account eligibility, instrument access, quote source, weekend/daily interruptions and rights are not yet checked. The token must stay in the server store; do not assume it is intrinsically read-only. Implement a price-only adapter with fixed practice host and no orders. The project's FX holdings are cash currencies, even if this provider offers leveraged products.

### Kraken

Public read-only [AssetPairs](https://docs.kraken.com/api-reference/market-data/get-tradable-asset-pairs), [Ticker](https://docs.kraken.com/api-reference/market-data/get-ticker-information), [OHLC](https://docs.kraken.com/api-reference/market-data/get-ohlc-data), trades/order-book and system-status endpoints need no trading key. AssetPairs probe on 14 October confirmed all three proposed USD pairs online with eight quantity decimals. SystemStatus returned online at `2026-10-14T21:38:23Z`, with upcoming maintenance notices; source status is time-specific.

Ticker bid/ask/last availability does not automatically supply an exchange source timestamp for every field. Use timestamped trade/stream evidence or an appropriately defined provenance contract; retrievedAt alone cannot prove quote freshness. OHLC includes a current uncommitted candle and a limited recent history (documented maximum 720 entries); exclude the unfinished candle. Rate and publication rights need review before sustained use. No private exchange account or order API is needed.

## Quota feasibility calculation (engineering estimates)

For 11 securities/FX symbols on one-credit endpoints, one shared hourly quote plus one hourly candle request costs at most `11 × 24 × 2 = 528` credits/day before retries, metadata and fills. Avoid polling securities when closed. Stagger calls below eight credits/minute; all five agents reuse the same snapshot. This is a proposed schedule, not a measured endpoint entitlement.

Next-eligible-quote execution requires additional post-proposal data. Maximum 30 fills/day across the five agents might add about 30 symbol requests if fetched efficiently; retries, pending/rejected proposals, FX valuation and health checks need a reserve. Hourly data is not continuously fresh. Fetch fresh shared quotes before decisions and subsequent eligible quotes for fills; test whether cadence/freshness rules can be satisfied within quota. Continuous minute polling of 11 symbols is not feasible on 800 credits/day (`15,840` symbol requests/day before candles). Kraken separates crypto traffic from that quota.

## Outstanding gates and owner actions

1. Completed for connectivity: free Twelve Data account/key connected through the ignored local secrets file and server-side environment. This does not certify execution/display/publication rights.
2. Verify each proposed security/ETF/FX instrument using timestamped actual quote and completed candle responses, during an eligible open session. Capture source venue/mode, entitlement, endpoint credit weight and errors. No success inferred from catalogue names.
3. Confirm internal non-display, private UI display, storage/export and YouTube/public screenshot rights; ask provider for terms if ambiguous. Paid data costs require separate explicit approval.
4. If securities coverage fails, assess Alpaca account eligibility/IEX sampling freshness and licence; do not assume a fresh IEX quote always exists for less active ETF symbols.
5. If FX coverage fails, verify OANDA practice eligibility and pricing access; no real account/funding/order credentials.
6. Completed Kraken quote/closed-candle probes for BTC/ETH/SOL; rate/licence and documentary-publication review remain open, with existing health/maintenance rejection intact.
7. Record all source versions and test session boundaries/DST/corporate actions before finalising the symbol universe. If a required class lacks adequate access, keep official preflight blocked and present scoped alternatives.

No market adapters or research integration were implemented in Phase 0. Phase 2 now has connected read-only adapters with all-symbol retrieval evidence; remaining execution/source and rights gates are stated above. Model availability and research API wiring remain deferred to Phases 3 and 4.
