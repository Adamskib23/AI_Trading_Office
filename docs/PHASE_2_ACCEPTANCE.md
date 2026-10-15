# Phase 2 acceptance evidence — 15 October 2026

This record concerns scripted TEST accounts only. No models, research tools, paid upgrades, publication, real orders or official experiment are enabled. Terminal prices remain off. Provider rights are scoped to the owner's reported internal-use reviews; redistribution is excluded.

## Sessions and source assumptions

- [NYSE 2026 calendar](https://www.nyse.com/publicdocs/nyse/ICE_NYSE_2026_Yearly_Trading_Calendar.pdf): 15–16 October are regular sessions. The existing New York calendar gives 13:30–20:00 UTC on these dates. Quotes are tested during that window, never filled from the previous close. No consolidated/SIP/NBBO claim is made.
- [Twelve Data Forex API v2](https://support.twelvedata.com/en/articles/12520817-forex-api-v2): continuous aggregate pricing from multiple contributors, weighted composite rates, minute-level mid-price updates. Our existing Sunday 17:00 through Friday 17:00 New York paper-conversion window is a conservative subset of this documented availability. It remains enforced even if the feed publishes weekend prices. This certifies the simulated conversion session, not an executable bank/broker quote. Freshness, automatic outage rejection and explicit synthetic spread/slippage/fees still apply.
- Initial weekday EUR/USD, GBP/USD and USD/JPY probes returned source clocks about 50 seconds old, with closed hourly candles. Source mode can be reviewed as live composite reference data for paper use, without claiming firm bid/ask or broker execution quality.
- Kraken retains public SystemStatus and server-clock checks, timestamped actual trades and closed OHLC candles; health failures prevent execution. Internal-use rights are based on the owner's 15 October review, not direct correspondence with Kraken.

## Bounded corporate-action review

Review window: current TEST activity on 15 October through **16 October 2026 20:00 UTC**. This is not a seven-day official-trial clearance. The engine still blocks expired reviews and does not invent split/dividend postings. Recheck announcements if conditions change or the test window is extended.

| Instrument | Primary evidence inspected | TEST assessment |
| --- | --- | --- |
| AAPL | [Issuer dividend history](https://investor.apple.com/dividend-history/default.aspx) and [issuer FAQ/split history](https://investor.apple.com/investor-relations/faq/default.aspx) | Latest declared distribution in inspected history was payable 13 August 2026; latest listed split was 2020. No announced dividend/split was identified within this short TEST window. This is a dated review, not a guarantee against new announcements |
| SPY | [Issuer 2026 distribution schedule](https://www.ssga.com/library-content/products/fund-data/etfs/us/distribution/SPDR_Dividend_Distribution_Schedule.pdf), version dated 14 October, page 3 | September ex-date 18 September, payable 30 October; next scheduled ex-date 18 December. Neither ex-date nor payment falls in the review window. No retrospective dividend is credited to a new TEST holding |
| GLD | [Current issuer page and announcement list](https://www.ssga.com/us/en/individual/etfs/spdr-gold-shares-gld), [prospectus linked by issuer](https://files.spdrgoldshares.com/spdr-cms/2025-10/GLD_Prospectus_10042022_as_filed.pdf), [September 2026 Form 8-K](https://www.ssga.com/library-content/products/fund-docs/etfs/us/tax-documents/2026-september-gld-form-8-k.pdf) | Trust generates no income and sells gold for expenses; inspected latest 8-K concerns a director appointment rather than unit changes. No split/cash distribution identified in the TEST window. Expense effects remain in the raw source price |

Only these three securities receive this bounded corporate-action clearance. MSFT, NVDA, QQQ, SLV and USO retain their independent unreviewed gates; no required asset class is removed. The five representative acceptance orders are AAPL, SPY, GLD, EUR/USD cash conversion and BTC/USD.

## Execution and recovery results

Results will be appended only after the corresponding checks actually run. Preparing a runner or scheduling a future check is not a pass. UTC midnight occurs at 01:00 London time on 16 October; the bounded overnight check stops at 01:06 London time, if started.
