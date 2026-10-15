# AI Trading Office — Technical Architecture v0.4 (MULTI-ASSET + WEB RESEARCH)

Date: 14 October 2026  
Status: **Owner-requested revised baseline for Codex; implementation subject to repository/provider audit**  
Owner: Human CEO  
Trial: **Five OpenAI agents; $1,000 simulated USD each; multi-asset paper trading; a seven-day (168-hour) official run that starts only on CEO action after preflight tests.**  
Initial OpenAI model + hosted-web-search allowance: **USD $20** (development and trial combined; external market-data/hosting costs separate).  

**Scope and build order:** Equities, ETFs, FX, crypto and commodity-related ETFs, plus controlled public web research, are required **for the first official seven-day trial**. But features are implemented sequentially: (0) repository/market-data feasibility, (1) office, (2) multi-market paper-trading infrastructure, (3) five configured agents trading from structured market data **without internet research**, (4) add bounded web research with citations and cost controls, (5) conversations and Messages/Research UI, (6) soak tests/documentary readiness, (7) owner-started trial. **“From day one” means the first day of the official trial, not the first development milestone.** Do not implement a crypto-only shortcut.  

## 1. Product definition and experiment scope

Adapt [a16z AI Town](https://github.com/a16z-infra/ai-town) into a persistent virtual financial research and paper-trading office. Five OpenAI employees have avatars, desks, strategies, portfolios, persistent memories, research tools and internal communications. Their trades are autonomous: a trusted simulator executes **eligible paper orders without any per-trade CEO sign-off**. The CEO can see all messages and research sources, inspect decisions and balances, intervene through audited controls, and create a documentary from original evidence.

### Trial scope — multi-market on day one

- **US equities:** selected liquid stocks, e.g. `AAPL`, `MSFT`, `NVDA`.
- **US ETFs:** broad-market `SPY`, `QQQ`, and commodity-exposure ETFs such as `GLD`, `SLV`, `USO` (subject to feed availability and licensing; the ETFs are proxies, *not* direct physical commodity/futures contracts).
- **Spot foreign-exchange conversions:** `EUR/USD`, `GBP/USD`, `USD/JPY` price references. FX is modelled as exchanges between **owned cash currencies** (`USD`, `EUR`, `GBP`, `JPY`), not leveraged CFDs or short FX positions.
- **Spot crypto:** `BTC/USD`, `ETH/USD`, `SOL/USD` on one chosen exchange.
- **Reference indices / economics:** use indices and macroeconomic releases for research even when an index cannot itself be bought; use verified ETFs for tradable proxies.

These are **illustrative configurable starter symbols, not a promise of feed access**. Codex must verify historical/quote availability, non-delayed timestamps and data licence for every enabled symbol before official start. Agents may trade across all enabled asset classes, irrespective of suggested research speciality; all have equal access to the same public instrument universe.

### Outcomes and non-goals

1. Five autonomous agents research finance on the public internet, cross-check claims against timestamped market data and either HOLD or propose paper orders.
2. Every accepted order undergoes automatic deterministically enforced position, funds, market-hours, freshness, rate and risk checks. No manual approval in normal operation.
3. Markets have independent session calendars; crypto remains tradeable on weekends, FX generally does not, and US equities/ETFs follow actual exchange trading sessions.
4. The browser-based office, first-class searchable Messages view, Research Feed, charts and leaderboard reflect server-backed events; activity continues with the browser closed.
5. A 168-hour official trial starts only after a recorded readiness gate and explicit owner action. Every input, quote, source, decision, fill, cost and manual intervention has an auditable event link.
6. Good documentary hygiene: meaningful screenshots/replay, properly attributed research sources, daily results, downloadable final report and no fabricated agent conversations.

**Explicit non-goals for first trial:** live or real-money brokerage/order integrations; brokerage deposits or wallets; leverage, shorts, margin, options, futures, CFDs or commodity derivatives; unrestricted browser/website login, shell/code execution, social-media posting, trading-account changes, self-modifying system prompts, self-modifying risk rules, voice, public multiplayer or 3D. These are not required to support stocks + ETFs + **unlevered currency conversion** + crypto + commodity proxy ETFs from day one. **Never silently label a commodity ETF as a commodity future, or a currency conversion as a leveraged FX position.**


## 2. Adopted technical stack

| Concern | Choice / notes |
| --- | --- |
| Base game | Fork `a16z-infra/ai-town`, pin exact upstream commit SHA and audit asset licences |
| Office frontend | React, TypeScript, PixiJS and existing AI Town engine; dashboard and searchable comms/research screens |
| Durable backend | Convex transactions, queries, actions and scheduled jobs; keep TypeScript for MVP |
| Agent runtime | OpenAI TypeScript Agents SDK / Responses API; `gpt-6-luna` as initial common model candidate (availability checked in Phase 3) |
| Agent internet research | OpenAI Responses **`web_search`** read-only tool, with source/citation capture, configurable rate cap and cost attribution |
| Public market data | **MultiProviderMarketData** orchestration with adapters per asset class, cached centrally: e.g. Twelve Data (multi-market candidate), Alpaca Basic/IEX (US stocks/ETFs), OANDA practice pricing (FX if accessible), Kraken/CCXT (spot crypto) |
| Instruments / market sessions | Typed `InstrumentRegistry` + timezone-aware `MarketCalendar` + exchange/holiday/early-close rules |
| Simulated execution | **One unified, custom server-side paper broker**, per-asset accounting, fees/spreads, next-eligible-quote fills, no broker order APIs |
| Owner authentication | Trusted server-side user auth + owner-only controls; adopt existing integration where secure |
| Tests | Pure financial maths with high-precision decimals, unit and integration tests, provider fixtures, browser smoke tests, deterministic clock |
| Hosting | Convex always-available scheduled backend (not dependent on game browser); Vite/React UI |

**Market-data selection is an engineering gate, not an assumption:** [Twelve Data Basic](https://twelvedata.com/pricing) currently advertises multi-asset free access but limited credits (8 per minute / 800 per day as documented). [Alpaca Basic](https://docs.alpaca.markets/us/docs/about-market-data-api) provides only an IEX real-time US-equity feed, not consolidated full-market SIP. [OANDA practice](https://developer.oanda.com/rest-live-v20/development-guide/) requires a practice account/token and has jurisdictional eligibility restrictions. [Kraken](https://docs.kraken.com/api/) public market feeds are crypto-specific. **No provider is assumed to deliver real-time, exchange-quality quotes for every asset in one free account.** Implement capability detection, source priority, coverage documentation, licensing check and explicit missing-feed errors. Never auto-upgrade to a paid feed or imply market-data fees are within the $20 model/API allowance.

**Upstream caveat:** Original AI Town has a browser-idle world auto-pause (per its README); **decouple financial schedules and chat persistence** from visual-world pausing. Audit Convex permissions and assets before public deployment.


## 3. System topology and trust boundaries

```text
                  HUMAN CEO — authenticated React / PixiJS OFFICE
          [avatars] [Messages] [Research Sources] [Markets] [Leaderboard]
                                    |
                         Convex real-time queries
                                    |
            +-----------------------+----------------------------+
            |                       |                            |
      World & messaging      Research & agents            Paper broker
      moves, chat, memory    OpenAI decision jobs      orders, risk, ledger
            |                       |                            |
            +-----------------------+----------------------------+
                                    |
                     Convex persisted event store
                                    ^
                 +------------------+-----------------+
                 |                                    |
     Market-data ingestion                       Agent scheduler
      + instrument registry                      and budget guard
      + market calendars                              |
      + quote provenance                       OpenAI Responses API
                 |                             + read-only web_search
        Quote providers                                |
        Stocks/ETFs | FX | Crypto                Research sources,
         (adapters)                                tool logs, citations

             Trusted server validates paper orders only.
                  No real-money order connector.
```

**Absolute boundary:** web pages and agents cannot become privileged financial execution code. Research returns untrusted data; the model proposes an order; a server-side deterministic `RiskPolicy` and `PaperBroker` independently enforce permissions and ledger mutations. FX, equities, ETFs and crypto must share accounting standards but have class-specific quote validity, sessions and fill policies. Events are immutable and correlated end to end.


## 4. Five agents and emergent specialisation

All initial agents run **the same model** (initial target `gpt-6-luna`) and start with **$1,000 virtual USD** each. They can investigate and trade **all enabled classes**. Suggested initial profiles give the documentary distinct characters; they do **not** lock agents into separate markets or give anyone privileged data:

| Employee | Initial research preference | Trading approach | Allowed markets |
| --- | --- | --- | --- |
| Alex | US equities / earnings | Trend-following | All enabled |
| Sophie | Forex / macroeconomics | Mean-reversion | All enabled |
| Marcus | Crypto / sentiment | Momentum | All enabled |
| Nina | Commodities and sector ETFs | Breakouts | All enabled |
| Oliver | Macro asset allocation | Defensive / diversified | All enabled |

Agents may naturally specialise based on evidence, opportunities or prior outcomes. Log actual exposure by asset class, daily stated focus, and strategy revisions. **Within-trial prompt/instruction changes require the CEO or a preregistered deterministic policy and must be labelled as interventions.** Agents may generate research notes or hypotheses without altering binding risk constraints.

Profile data: `id`, `avatarId`, `deskId`, `displayName`, `provider`, `modelId`, `promptHash`, `strategyVersion`, `toolsAllowed`, `specialtyTags`, `dailyBudgetUsd`, `webSearchBudget`, `enabled`, `nextRunAt`, `lastRunAt`. The model/provider is swappable later for a Claude employee without changing the ledger or visual world.

**Permissions:** agents may read approved market snapshots, calendars, public web research, their own portfolio/memories, public channels and authorised DMs; write research notes, messages, short explanation summaries and typed *paper* order proposals. They cannot set prices/fills or change capital, risk limits, market clocks, auth, model access policies, data feeds, job caps or research-provider credentials. CEO can manage settings via an authenticated UI with append-only audit trails. No normal per-trade approval.


## 5. Multi-market trading rules, data acquisition and market calendars

### 5.1 Configurable first-run asset universe

| Asset class | Proposed enabled starter symbols | Exchange/session model | Execution / holdings model |
| --- | --- | --- | --- |
| US shares | `AAPL`, `MSFT`, `NVDA` | US primary listing exchange calendar; NY timezone and holidays | Buy/sell long shares; fractional shares **only if explicitly simulated** with recorded precision |
| US equity/index ETFs | `SPY`, `QQQ` | US equity session | Buy/sell long units (fractional assumption documented) |
| Commodity-linked ETFs | `GLD`, `SLV`, `USO` | US equity session | Buy/sell ETF units; **not physical metal, crude futures or commodity CFD** |
| Spot forex | `EUR/USD`, `GBP/USD`, `USD/JPY` | FX calendar, approx. 24/5 with broker-specific downtime | Convert cash held between `USD`, `EUR`, `GBP`, `JPY`; **no margin/negative cash** |
| Spot crypto | `BTC/USD`, `ETH/USD`, `SOL/USD` | Exchange-specific 24/7, except outages/maintenance | Buy/sell long fractional units on a single selected public venue |
| Macroeconomic/reference | Published policy decisions, CPI, jobs, index level | Release timestamps, no trade session | **Research-only** unless mapped explicitly to a tradable ETF |

Codex must verify symbol naming and real data entitlements. Start with this **small but genuinely multi-asset** universe, not every global stock or derivative. Agents select their own focus from these options. The CEO can configure additional symbols **before** experiment lock; log the actual enabled list. If a proposed class is unavailable, **do not quietly omit it**: flag the preflight as incomplete and explain what provider/entitlement is needed.

### 5.2 Instrument registry and data contracts

One canonical `instrumentId`, `assetClass`, `venue`, `providerSymbol`, `displaySymbol`, `baseCurrency`, `quoteCurrency`, `tradingCurrency`, `tickSize`, `quantityPrecision`, `minNotional`, `fractionalAllowed`, `tradability`, `timezone`, `marketCalendarId`, `feeScheduleId`, `quoteSourceId`. For ETFs, include `exposureType` (e.g. `commodity_proxy`) to stop conflating underlying with wrapper.

Implement interfaces:

```ts
interface MarketDataProvider {
  getQuote(instrumentId: string): Promise<Quote>;
  getClosedCandles(instrumentId: string, range: CandleRange): Promise<Candle[]>;
  getProviderCapabilities(): Promise<Coverage[]>;
  health(): Promise<ProviderHealth>;
}
interface MarketCalendar {
  getSessionState(instrumentId: string, atUtc: string): Promise<MarketState>;
  nextTradableInstant(instrumentId: string, atUtc: string): Promise<string | null>;
}
interface PaperBroker {
  proposeOrder(request: PaperOrderRequest): Promise<OrderDecision>;
  applyNewQuote(quote: Quote): Promise<FillResult[]>;
  markPortfolio(agentId: string, asOfUtc: string): Promise<PortfolioMark>;
}
```

A canonical Quote has `instrumentId`, `provider`, `venue`, `sourceTimestamp`, `retrievedAt`, `bid?`, `ask?`, `last?`, `currency`, `sourceMode` (live/delayed/indicative), `dataRights`, `quoteId`, `providerStatus`. Record per-source data delay explicitly; treat `bid` and `ask` as unavailable rather than inventing them. Persist closed OHLCV candles, distinguish split-adjusted vs raw prices, and never feed incomplete/future candles to agents. Cache server-side shared data across all five agents and obey provider limits.

**Data quality:** no invented bid/ask; if only last/mid is available, *disclose and use a configured simulated spread* (different for FX/crypto/equities). If a provider is delayed, avoid presenting delayed data as real-time and do not assume fill quality matches a live market. For a meaningful paper experiment prefer timely quote data; if a class only has delayed data, record a methodological limitation and either delay decisions consistently or block its trades until source coverage is adequate.

### 5.3 Different market clocks

- **US equities/ETFs:** only execute inside the chosen exchange's standard continuous session at first (normally 09:30–16:00 America/New_York on trading days; holidays/early closes must be obtained from a market calendar). Never silently fill overnight/weekend orders at last close.
- **Forex:** generally open from Sunday evening to Friday afternoon in New York time, with weekend close and possible broker daily maintenance pauses; verify selected feed's actual session and calendar.
- **Crypto:** continuous except API outages and exchange maintenance.
- Market closed is **not** the same as broken/stale provider. While closed, retain a labelled last-traded valuation timestamp. **Do not** automatically reject the entire multi-asset portfolio as stale because US equities are closed. For new orders when closed, record `MARKET_CLOSED` or a time-limited `WAITING_FOR_OPEN` state and revalidate at opening; simplest first-trial default is **reject with clear reason and let the agent retry next open**, avoiding unexamined queued market orders.
- Quote ingestion may happen frequently where provider credits permit, but agents decide on a shared **hourly** schedule and can respond to major events with bounded extra analysis. Ensure agents in each decision cycle see the same completed data cutoff; persist exact timestamps and source hashes.

### 5.4 Server-authoritative paper execution

- **Opening funding:** five independent accounts each receive `USD 1000.00`, no securities/crypto and no non-USD cash.
- **Securities/ETFs/crypto:** typed `BUY|SELL` long-only orders for allowed instrument IDs; never sell more than owned or go negative. Fractional US equity fills, if used, are an explicit simulation simplification.
- **FX:** typed `CONVERT_CURRENCY` order specifies `fromCurrency`, `toCurrency`, `amountFrom`, and cited FX `instrumentId`; compute at the appropriate side of observed bid/ask or documented effective simulated spread. Use real portfolio cash balances in four currencies; cannot create short cash or leveraged currency exposures. For example, converting `$200 USD → EUR` buys euros; later euros may be converted back to dollars. A `USD/JPY` pair is a quote, not a warrant to enter a leveraged USDJPY contract.
- **Order lifecycle:** model proposal → schema/permission validation → market open + quote freshness + funds + concentration + trade-count checks → `ACCEPTED` or explicit rejection → **first eligible subsequent quote** → simulated fill with recorded bid/ask, explicit spread/slippage/fees; atomic ledger posting. Ignore model-provided execution prices. No look-ahead bias.
- Pricing should use a class-specific synthetic fee/spread/slippage schedule; label every schedule as a **model assumption**, not real broker pricing. Store gross, fee and price-improvement/slippage separately. When only delayed data is available, avoid pretending the simulated fill was live.
- Corporate actions: test for share splits/dividends/distributions affecting the 7-day period. Either apply verifiable cash and share adjustments or block affected symbols with an audited reason; never show false P&L caused by unadjusted data.
- Dividends may create cash, which must be a typed ledger event with an ex-date/record/pay source. Do not silently invent adjusted/unadjusted prices.

### 5.5 Initial cross-market risk policy

- Maximum **$200 USD equivalent** per new order; valuation currency conversion from supported current valid FX quotes.
- Maximum **30% portfolio equity** per *single tradeable asset*; max **60% per asset class** to allow but discourage market concentration (document policy and treatment of USD, cash currencies and ETF proxies).
- Maximum **6 filled orders per agent per UTC day** across **all classes**, not six per market. Minimum notional `$10` equivalent.
- **Never** permit negative currency balances, negative securities/coin quantities, leverage or shorts. No futures, options, margin or CFDs.
- Pause new orders after **5% UTC-day drawdown** or **15% from initial capital**, subject to recorded manual policy; disclose FX translation effects.
- Broker-specific risk logic is immutable to agents. Wrong-session orders, unknown instrument, missing quotes or underfunded conversions reject automatically with explicit reason. No human review in the normal order path.
- Global owner kill switch, per-agent pause, separate provider-incident pause for affected class only (unless overall integrity compromised).

All paper fills must be clearly labelled **SIMULATED** in every screen, API export and YouTube research output.


## 6. Multi-currency ledger, valuation, benchmarks and leaderboard

- Use integer minor currency units or a decimal math library (and configured precision for crypto/FX); no floating-point rounding as the ledger authority. Each agent ledger contains independent currency cash accounts (`USD`, `EUR`, `GBP`, `JPY`), security/ETF unit positions, crypto balances and an append-only posting trail.
- Every execution makes balanced debit/credit entries in the correct asset and currency, with idempotency key `(experimentId, agentId, decisionCycleId, proposalIndex)`; rejected orders have no financial postings. Prevent double fills under retries.
- USD is the **reporting numeraire**, not a restriction on forex trading. `equityUSD = USD cash + translated foreign-currency cash + market value of US securities/ETFs + crypto`, using saved conversion rates and instrument quote timestamps. Do **not** charge a fictional conversion fee for mere marking-to-market; charge configured costs only when an actual simulated currency conversion occurs.
- For markets closed over the weekend, use **last valid closing mark clearly marked with its timestamp**; closed-market valuation is not evidence that the market was open or that a trade was executable. If rates are materially stale or missing, flag portfolio equity as partially unpriced rather than fabricate a price.
- Mark equity at consistent UTC snapshots; save per-component source times. Reconcile replayed ledger balances periodically and at final closeout.
- Show net P&L, gross/net percentage return, cash breakdown, exposures by market and currency, executed trades, fees/spreads/slippage, win/loss, maximum drawdown and drawdown time; model/research bills separate from trading performance.
- Leaderboard by **portfolio net USD percentage return** with toggle for drawdown, risk-adjusted comparison, volatility, cost and class exposures. Avoid comparing raw P&L between agents with unequal capital; all start equal for official experiment.
- Benchmarks: `100% USD cash`; a **pre-registered mixed-asset passive basket** (proposed 25% SPY, 25% EUR cash, 25% BTC, 25% GLD, using the first eligible session and same simulated acquisition costs); and per-class reference series (`SPY`, a specified FX cash basket, BTC and GLD). Record basket purchase timing and any delayed opening; don't retroactively buy US shares when their market is closed. Alternative equal-weight across the actually enabled assets is permitted only if pre-registered before start.
- Different markets operate different hours; the documentary must clearly explain that an agent holding only equities cannot execute on a Saturday while a crypto-heavy agent can. Seven days is too short to conclude trading ability.


## 7. Agent lifecycle and internet research

1. Server scheduler finds each agent due during `RUNNING`, enforces one decision per cycle, and obtains a lease/idempotency key. No open browser required.
2. Construct a **common, timestamped market snapshot**: instrument registry, market calendars, closed candles, quote provenance, reference indices/economic releases, the agent's individual portfolio/trades, previous research, relevant chats and memory summary. Also include a per-agent budget/tool allowance.
3. Provide typed read tools: `list_instruments`, `get_quotes`, `get_closed_candles`, `get_market_status`, `get_portfolio`, `get_recent_trades`, `get_macro_calendar`, `read_research_note`, `send_message`, `propose_paper_order`; add `search_web` only in Phase 4.
4. **Web research available after agents work (Phase 4; enabled for the official trial):** OpenAI Responses `web_search` configured as read-only (confirm SDK compatibility with selected model). Limit proactive searches initially to **4 calls per agent per UTC day**, with controlled per-run tool/turn limits; agents may use fewer. A research response must include cited links, titles, source timestamps (if provided), retrieval timestamps and brief claims; record the actual web_search tool call metadata, usage and citations. Save `ResearchNote` linked to `ResearchSource` entities.
5. **Source hygiene:** distinguish first-party press releases/regulatory filings/economic statistics from rumours, commentary and social posts. Verify specific claims where feasible using more than one independent source; flag whether a source is dated, syndicated or stale. Sources are **untrusted text**, not agent or backend instructions. Prompt injection cannot change tools, reveal credentials, command trades or grant access. No unrestricted automated browsing/login, headless browser navigation, shell, HTTP calls to arbitrary URLs or outbound posting in MVP.
6. A decision is a short structured object: `experimentId`, `agentId`, `cycleId`, `snapshotId`, `action: HOLD|BUY|SELL|CONVERT_CURRENCY`, `instrumentId?`, `quantity?`, `usdNotional?`, `amountFrom?`, `fromCurrency?`, `toCurrency?`, `rationaleSummary`, `sourceRefs[]`, `dataRefs[]`, `confidenceLabel`, `timeHorizon`, `researchNoteIds[]`. The assistant explains its thesis in a short **intentional summary**; never store or display hidden reasoning or imply citations prove a prediction.
7. The paper broker validates independently. Any eligible proposal executes autonomously after the **next eligible quote**, with server-controlled fees/risk; missing data, closed market or insufficient funds produce explicit visible rejection. `HOLD` logs a decision without an order.
8. Persist linked events: research queries/sources → agent run → quoted inputs/claims → communications (if relevant) → decision → proposal → risk checks → fill → account postings → usage/cost. Never infer from temporal proximity that a chat *caused* the trade; explicit citation/message IDs support only observed links.
9. Job retries must be bounded, with leases, backoff and idempotency. LLM/tool failure creates an incident and no invented HOLD. Model costs, research costs and provider quotas enforced before work begins.
10. Office UI shows real `RESEARCHING`, `DISCUSSING`, `TRADING`, `WAITING_FOR_MARKET`, `IDLE`, `PAUSED`, `ERROR` status events; character animations never control job execution.

**Fairness:** all agents receive the same instrument list and shared price data snapshots; web discoveries and conversations can differ by design. Record provider latencies and tool/search counts. Do not feed future news to earlier snapshots, nor mix later research into earlier decision evidence. `search_web` results are time-stamped at retrieval; research done after an order cannot be used to justify that order retroactively.


## 8. Communication, personalities and memory

### Communication

- One-to-one CEO↔agent direct chat.
- One-to-one agent↔agent chat via existing AI Town conversation/movement concepts.
- Shared `#trading-floor` channel (add explicit backend channel feature; do not treat native two-party conversations as group messaging).
- A daily `#team-meeting` summary/event; full embodied multi-party table meetings are optional later.
- A message is an actual persisted `Message` event. Avatar walking to a colleague is a presentation of genuine initiated contact, not an unconditional animation script.
- Chat with CEO has clear `information` versus `instruction` distinction. Only authenticated CEO can issue policy-changing commands through separate typed UI actions. Ordinary chat text cannot bypass permissions.
- Limit agent↔agent chats to e.g. two proactively initiated contacts per agent per day to avoid endless conversation loops and runaway bills. Add anti-loop cooldown and TTL to message-triggered jobs.

### Central communications centre — release-critical feature

Build a persistent **Messages** view accessible from the office top navigation (not merely speech bubbles or agent profile popovers).

- Desktop layout: channel/DM selector on the left, chronological conversation on the right, and optional inspector drawer with context. Default **All activity** shows every agent-to-agent and agent-to-CEO message the authenticated owner is authorised to view, with clear sender → recipient, channel, and time.
- Tabs: **All**, **Trading floor**, **Direct messages**, **Meetings**, **CEO**; filter by sender, recipient, date/time, channel, asset class and any enabled symbol (stocks, ETFs, FX or crypto). Search message text and thread titles on the server with appropriate indexes.
- Stream new messages using Convex subscriptions. Include unread counts, scroll-to-message, thread jumping, pagination, local/UTC timestamp toggle, and copy/share affordances. A clicked avatar opens that agent's communication history; a clicked speech bubble deep-links to the exact persisted message.
- Distinguish messages (written by agents or CEO) from system-generated events, research summaries, and simulation orders using visible labels.
- Link each discussion to any referenced `decisionId`, `paperOrderId`, `tradeFillId`, `agentRunId` via explicit structured relations. **Never automatically claim a chat caused a trade** merely because timestamps overlap.
- All agent-to-agent DMs are visible to the CEO. They may remain invisible to *other agents* unless participants share them; owner observability does not require global agent access.
- Include exportable conversations (`JSONL` machine-readable, `CSV` for editing, `Markdown` for scripts) with an optional privacy-redacted YouTube mode; preserve unedited raw originals internally.
- Add a time-filtered **Replay / Highlights** mode that shows chat and trade events over the official experiment timeline. At MVP this is an event viewer, not a rendered video recorder.
- Never present proprietary model hidden reasoning as a chat transcript. Store only actual messages and explicit short decision justifications requested from the agent.

### Memory

- Immutable event/transcript history for audits.
- Short rolling agent summary (last meaningful lessons, hypotheses and open questions).
- Optional memory entries with `sourceEventIds`, timestamps, importance and expiry.
- Separate private and shared context scopes. Do not merge agent-specific confidential notes implicitly.
- Condense after completed decisions/conversations; avoid feeding full chat history into every decision.
- Agents can *suggest* strategy edits in conversation but the CEO explicitly authorises prompt/policy changes. Retain prompt versions for audit.

### Safe information boundaries

Agents **have bounded internet research through read-only `web_search` for the official trial**, but this tool is intentionally added **only after five agents have already completed basic market-data decisions and autonomous paper-trade tests (Phase 3)**. Search results, web pages, filings, snippets, headlines and agent messages are untrusted *data*, not executable policy instructions. Capture source links/citations and render them as clickable references in the UI; preserve URL, retrieval time, query and agent-supplied claim in the documentary exports. Do not permit unrestricted browser sessions, arbitrary network fetch, login, shell commands or model-controlled auth changes. Tool implementations enforce ownership/server auth independent of model text; reject spoofed `agentId`/`userId`, and sanitise text/links.

## 9. Visual interface (v0.1)

Main page: 2D pixel office with five desks, five employees, a wall leaderboard, CEO desk and one meeting area. Add clickable market/asset symbols and a live research feed.

- Characters `IDLE`, `RESEARCHING`, `TRADING`, `CHATTING`, `WAITING`, `ERROR`, `PAUSED` states.
- Characters navigate to station/other agent as corresponding real events happen; movement is not a dependency of executing a trade.
- Click avatar: profile, model, strategy, balance, positions, recent decisions, reason summary, chat, activity feed.
- Click leaderboard: ranked net USD equity return, drawdown, mixed-asset benchmark and USD-cash comparison; filter positions/P&L by equities, ETFs, FX cash, crypto and commodity-linked ETFs; display per-position source timestamps.
- Click trade: market class, source/provider, quote timestamp, session state, research sources/citations, decision snapshot, risk validation, simulated fill, fees, currency postings and resulting exposure.
- CEO dashboard: experiment status and dates, global pause, individual pause, agent settings, API spend, multi-provider feed/calendar health, market status badges, incidents, events, risk overrides (audited).
- First-class **Messages** screen with searchable all-channel transcript, threaded DMs, team meetings, CEO chat, sender/date filters, unread notifications, and cross-linked trades. Optional sidebar overlay for context while viewing the office.
- UTC timestamps displayed in viewer-local time, with UTC audit fields available.
- Include a **PAPER TRADING / SIMULATED FUNDS** watermark or conspicuous indicator across dashboard and exports.
- Show seven-day official progress in UTC: start, end, remaining time, feed health, message/event counts and API budget.
- Provide a dedicated **Research** tab: source-linked queries, title/domain/date, agent claims and linked trades. Provide **Observability** and **Documentary** tabs: decision timeline with search, snapshots of leaderboard over time, annotations, charts, daily summaries and export controls.

Keep interactions desktop/browser-first; responsive layout nice but not a release blocker. Reuse licensed pixel art and map resources where permitted. Avoid spending first sprint on expensive bespoke art.

## 10. Convex schema and domain contracts (proposed)

Adapt naming/indexes to existing repository conventions after code inspection; avoid duplicate sources of truth for existing AI Town conversations.

```text
experiments          id, phase(TEST|OFFICIAL), status, startUtc?, endUtc?, ownerId, rulesHash, universeHash, researchPolicyHash, budgetUsd
agentProfiles        id, experimentId, avatarId, modelId, promptHash, preferredMarkets[], strategy, enabled, toolBudget
agentJobs            id, experimentId, agentId, cycleId, status, leaseUntil, attempts, lastRun
instruments          instrumentId, assetClass, venue, quoteCurrency, baseCurrency, providerSymbol, calendarId, precision, tradability, exposureType?
marketCalendars      calendarId, venue, tz, holidaySource, sourceVersion, nextOpenUtc?, nextCloseUtc?
providerCapabilities providerId, instrumentId, mode, quota, entitlementState, lastValidatedAt
marketSnapshots      quoteId, instrumentId, providerId, sourceTs, fetchedAt, bid?, ask?, last?, priceMode, status
marketCandles        instrumentId, providerId, interval, startUtc, closeUtc, adjusted, ohlcv, isClosed
marketIngestEvents   providerId, instrumentId, sourceTs, incident?, quotaRemaining?
researchQueries      queryId, experimentId, agentId, runId, requestedAt, completedAt?, toolType, cost, outcome
researchSources      sourceId, queryId, url, title?, publisher?, publishedAt?, retrievedAt, summary?, citationAnnotation?, hash?
researchNotes        noteId, agentId, runId, createdAt, claims[], sourceIds[], relatedInstrumentIds[]
agentDecisions       id, experimentId, agentId, runId, snapshotId, action, instrumentId?, rationale, sourceIds[], createdAt
paperOrders          id, agentId, experimentId, decisionId, instrumentId?, fromCurrency?, toCurrency?, amountFrom?, side?, qty?, status, rejectReason?
paperFills           id, orderId, quoteId, executedAt, price, qty, gross, fee, spread, slippage
ledgerEntries        id, experimentId, agentId, orderId?, assetOrCurrencyId, delta, ledgerType, timestamp
portfolioMarks       id, agentId, experimentId, atUtc, holdings[], cashBalances[], equityUsd?, componentsSourceTs[], valuationStatus
benchmarkMarks       id, experimentId, benchmarkId, atUtc, equityUsd, assumptionsHash, priceSourceIds[]
channels             id, experimentId, visibility, channelType, participantIds[]
messages             id, experimentId, channelId, senderId, recipientId?, content, sentAt, linkedEventIds[]
memories             id, agentId, scope, summary, evidenceIds[], createdAt
agentUsage           id, agentId, runId, model, modelTokens, webSearchCalls, estimatedModelUsd, estimatedSearchUsd, providerBilledUsd?
adminAudit           id, ownerId, action, paramsHash, occurredAt
incidents            id, severity, experimentId, providerOrAgent, code, createdAt, resolvedAt?
experimentEvents     id, experimentId, eventType, referenceIds[], occurredAt, redactedSummary
budgetReservations   id, runId, estimatedModelUsd, estimatedToolUsd, actualUsd?, status
reports              id, experimentId, utcDate, metricsHash, narrative, exportLocation?
```

### Interfaces / trust contracts

- `InstrumentRegistry`: canonical instrument identities, calendar, unit conventions, tradeability and data source.
- `MarketDataProvider`: standard quote/candle/health/capabilities data with timestamp and rights.
- `MarketCalendar`: true closed/open state per venue; exchange holidays and DST (UTC everywhere for events).
- `PaperBroker`: execute securities/crypto long-only and **unlevered forex conversions**; no real broker order functions.
- `RiskPolicy`: deterministic server-only validation across markets, currencies and notional amounts.
- `ResearchService`: read-only tool calls, source provenance/citations, tool budget, untrusted-text handling.
- `ModelRuntime`: OpenAI initially, adapter for future Claude; model/version pinned per run.
- `MessageBus`: authenticated, persistent DM/channels without automatic unbounded chat loops.
- `EventLogger`: append-only trade, discussion, research, configuration and incident provenance.

Read-only **market-data provider keys** may be used on server when needed (e.g. paid/free-tier quote APIs). **Never introduce live brokerage trading-order credentials.**


## 11. Reliability, privacy and security

- Test the inherited AI Town auth and access-control code. A public GitHub PR has described missing sender/world validation; treat as an audit item, not a confirmed fix.
- Owner authentication required for every `CEO` mutation; enforce authorisation in Convex server functions, not by hiding UI buttons.
- Backend OpenAI and *read-only market-data* API secrets in Convex environment variables only; no `VITE_` client-prefix API keys; never commit `.env` secrets.
- Project-scoped OpenAI key and read-only data-provider keys (where required) with usage monitoring and minimum permissions; never insert live brokerage order keys.
- **Initial project-wide model API budget: `$20` USD**, covering **model inference plus hosted `web_search` tool calls** during development/testing and the initial trial unless replenished by owner. Market-data subscriptions/hosting are additional and require separately disclosed approval. Show spend broken down by `TEST` and `OFFICIAL` experiments so development costs do not disappear. Warn at 70% and 90% of allocated allowance.
- Central, server-only admission controller: before every model/research call, reserve a conservative maximum for token/output **and per-web-search tool calls** (plus search content tokens) based on current pricing; deny new requests once `consumed + outstanding reservations + estimated new cost > allowed budget`. Set strict per-run maximum output tokens, tool-turn limits and rate limits. Reconcile reservations against reported usage on completion or failure.
- The `$20` threshold is an **application-level budget guard**, not a guaranteed upstream OpenAI billing hard cap. External API metering lag, in-flight requests, tool charges and estimation errors can cause small overruns. Monitor OpenAI billing limits separately; do not promise exact provider-side enforcement.
- Distinguish paused AI activity from ongoing paper portfolio marking: budget exhaustion should stop new agent inference and trigger an incident; never silently fabricate HOLD decisions or continued autonomous trading.
- Logs redact API secrets and private credentials. Use trace IDs to correlate agent run→decision→order→fill.
- Stop accepting orders on stale market data or repeated reconciliation discrepancy.
- Periodic independent ledger reconciliation: recompute **multi-currency cash, crypto balances and security/ETF quantities** from funding, conversions, dividends/corporate actions and fills; compare to cached portfolio.
- No reliance on whether front-end is open for cron or background tasks.
- Manual recovery and reset paths should create a **new experiment** instead of wiping history.
- Future real-money adapter, if ever considered, demands a new security review, separate credentials, separate deployment, additional approval and stricter controls. Not part of this architecture approval.

### Web and external-feed security (multi-market controls)

- No direct open internet access to privileged backend actions. Web research is through a capped read-only search interface, with source content isolated from policy and system prompts; ignore instructions embedded in articles or pages.
- Do not let URL annotations supply server-side arbitrary fetch targets or leak tokens via query strings. No SSRF, paywall circumvention, scraping of restricted sites or autonomous login; respect rate limits/licences. Verify web-search citations render as clickable references.
- Research source publication time, fetched time and evidence ID are mandatory where available. Missing date is labelled **undated**, not assumed current.
- Market-data permissions and licensing are distinct from LLM research. Public web news **cannot be used as the authoritative price/fill feed**.
- Provider secrets never appear in agent messages, model prompts, client bundles, logs or documentary exports.


## 12. Model, web-search and data budgets

Initial five agents use `gpt-6-luna` under identical model configs, subject to availability checking when agent integration begins. A `gpt-6-sol` or non-OpenAI model comparison can be added after the first run. Confirm current models and quotas **in Phase 3**; check `web_search` support, citations and additional search fees **in Phase 4** before using that tool.

Indicative published standard pricing as checked 14 October 2026:

| Billable component | Indicative unit price | Initial policy |
| --- | --- | --- |
| `gpt-6-luna` input | `$0.10 / 1M input tokens` | Standard model for five employees |
| `gpt-6-luna` output | `$0.50 / 1M output tokens` | Restrict output and tool turns |
| OpenAI hosted `web_search` | `$10.00 / 1,000 search calls` **plus** search-content tokens at model rate | Initial cap **4 searches per agent per UTC day**; adjustable by CEO |
| Price/market-data providers | Provider-dependent; free quotas may not support all desired symbols/frequencies | **Not covered by $20 OpenAI allowance**; validate entitlements before start |
| Hosting | Provider-dependent | Monitor separately |

Example only: five agents × 24 scheduled decisions × seven days = 840 decisions. A simple single-generation 4,000-input/800-output token decision at Luna's published rates costs roughly **$0.0008 per decision** or `$0.67` for 840 calls **before** research, extra turns or other usage. Five agents × 4 daily searches × 7 days = **140 search calls**, i.e. **$1.40 in per-call fees** plus returned content tokens and any reasoning tokens. Real research could use substantially more tokens and supplementary model calls. This is **not a forecast of the complete bill**.

Enforce a best-effort **$20 project-wide model + search budget** (development and experiment combined), with warnings at 70%/90%, reservations for outstanding jobs and a safe stop on exhaustion. Clearly display separate `DEV`, `TEST`, `OFFICIAL`, tokens, tool calls and spend totals. The official run should not begin if insufficient reserve remains to complete a reasonable portion of the study; CEO must explicitly replenish rather than silently disable internet research or fake autonomous activity. External billing may exceed app estimates; set OpenAI account-side budget alerts as additional protection.

Sources: [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [web search guide](https://developers.openai.com/api/docs/guides/tools-web-search), [GPT-6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [Twelve Data](https://twelvedata.com/pricing), [Alpaca market-data plans](https://docs.alpaca.markets/us/docs/about-market-data-api).


## 13. Implementation roadmap for Codex (milestones, not one giant diff)

**Development order ≠ official experiment feature set.** Complete and verify each phase before enabling the next. All asset classes and read-only web research must be operational **before the owner starts the seven-day official experiment**.

### Phase 0 — Fork, run and multi-market feasibility audit **ONLY** for first Codex pass

- Fork/clone AI Town and record SHA, run the baseline app locally; inspect game engine, database/auth, idle auto-pause, asset licensing, tests and deployment assumptions.
- Audit the feasibility of market-data coverage for equities/ETFs (including commodity proxies), FX and crypto. List quote sources, latency/delay, sessions, entitlements, costs/limits, and any owner actions needed. **Do not integrate or test web search in this phase.**
- Deliver `docs/PROVIDER_DECISIONS.md`, a realistic initial symbol/provider matrix, and a phased implementation plan.
- Stop for owner checkpoint. No model calls, subscriptions, agent loops or official paper experiment.

### Phase 1 — Office and instruments

- Establish five persistent avatars/desks, CEO dashboard and experiment state; implement instrument registry, venue calendars, market status and multi-asset symbol configuration.
- Display agent identities and research-speciality preferences (without invoking agents yet).

### Phase 2 — Multi-market feeds, ledger and deterministic paper execution

- Implement verified feeds for stocks/ETFs (including commodity proxy ETFs), FX and crypto, source timestamps, market closures and quote health.
- Implement decimal-safe multicurrency balances and positions, risk controls, commission/spread/slippage assumptions, and **next-eligible-quote** fill simulation.
- Validate using deterministic scripted traders only. Test closed sessions, currency conversion, insufficient cash, duplicate orders, stale/missing quotes, corporate-action policy and full reconciliation. No actual LLM calls needed.

### Phase 3 — Configure and test the five OpenAI trading agents (NO web search yet)

- Configure five persistent OpenAI agents with model, profile, individual strategy, tools, memory, per-agent simulated wallet and budget monitoring.
- Provide trusted typed tools to inspect price/candle snapshots, portfolios, instruments, market calendars and recent trades; agents can HOLD or independently submit paper orders. The simulator enforces the risk policy, not the agents.
- Test one agent thoroughly, then all five under the unattended scheduler, using **structured market data only**. Confirm autonomous trade submission, provenance, restart/idempotency and portfolio correctness before enabling research.
- Persist short decision/rationale summaries. Leave `search_web` disabled and do not enable unbounded social loops.

### Phase 4 — Add controlled internet research (AFTER agents work)

- Introduce read-only OpenAI hosted `web_search` (or an owner-approved alternative), tool access scoped to agents, daily query limits, token/cost guards, source citation persistence and prompt-injection protections.
- Verify model/tool compatibility, link research and source timestamps to actual decisions, and ensure research cannot overwrite quote prices, modify simulator policy or execute privileged actions.
- Test representative financial-news, earnings, economic and cross-market queries and prove that agents still behave safely when searches fail or return stale/malicious content.

### Phase 5 — Conversations, CEO, and inspectable office UI

- Deliver searchable, chronological **Messages** UI (DMs, trading floor, meetings, CEO chats) plus the **Research** UI with source links/citations, searchable agents/instruments and deep links to orders.
- Add bounded agent-to-agent messaging, CEO chat, avatar status reflecting real activities, independent scheduling, and traceable event replay/export hooks.

### Phase 6 — Observability, documentary toolkit and readiness checks

- Pre-register the experiment protocol (market universe, providers, calendars, prompts, search quotas, risk caps, fees, benchmarks), implement daily evidence exports/report templates and verify paper-only boundaries.
- Validate security, full ledger reconciliation, market-data quality, unexpected closures, best-effort **$20 model + search budget** and kill switch.
- Complete a 24–72-hour unattended **TEST** run with all five agents, all approved markets, communications and research on. The CEO-only **Start Experiment** button remains unavailable until all gates pass.

### Phase 7 — Owner-started seven-day official trial and review

- Owner starts a new, immutable **168-hour** run with fresh `$1,000` paper accounts per agent; all approved asset classes, web research and communication enabled from its beginning.
- Capture real daily messages, source citations, market status, portfolio performance and costs; stop new orders at expiry and generate an auditable report and documentary export bundle.

**Work in small verified commits, never commit credentials or start an experiment automatically.**


## 14. Acceptance criteria for revised v0.4

- [ ] Exactly five persistent employees; same configured OpenAI model at baseline, distinct strategy preferences, access to all enabled classes; `$1,000` paper USD per agent.
- [ ] At least **one US stock, one broad ETF, one commodity-linked ETF, one FX currency conversion, and one spot crypto** each demonstrably simulated with verified provider data and correct execution timestamps **before the official run**.
- [ ] Active initial tradable universe contains US stocks, ETFs (including commodity proxies), forex currency conversions and crypto; no crypto-only placeholder. Provider entitlements/costs reviewed by owner.
- [ ] Market hours/holidays/timezones are per instrument; no US equity fills on Saturday, no FX fills over closed weekend, crypto operates through weekend; open/closed/stale are distinct UI/backend states.
- [ ] No leveraged FX, borrowed cash, negative quantities, futures/options/CFDs, exchange live orders or API trade keys; automatic paper risk validations enforce no manual sign-off.
- [ ] Five agents can operate **first without web search** (Phase 3): market-data tools, autonomous paper orders, budgets, memory and restart-safe scheduling pass tests.
- [ ] **After that**, five agents can query public web (Phase 4) with provenance URLs, timestamps, citations, tool usage/costs and prompt-injection-resistant read-only scope; all web tools are enabled by official-trial start.
- [ ] Browser closed does not affect agents/jobs/ledger. Decision logs link exact quotes, sources, messages, strategies and filled/rejected orders.
- [ ] Decimal-safe multi-currency cash ledger reconciles; idempotency/retry/commission/FX-spread/rounding and corporate-action tests pass.
- [ ] Leaderboard uses consistent USD mark-to-market, class exposure and timestamps, mixed-asset benchmark and USD cash baseline; closed market marks are clearly stale-but-expected.
- [ ] Owner-visible, searchable private/group messages and CEO chats; Research screen with live links and source/claim/trade context; event replay and documentary exports.
- [ ] Model **and web-search** charges metered against best-effort initial `$20` allowance, with alerts/stops; paid data/hosting costs are separately surfaced.
- [ ] No model-supplied order fill prices, balance writes, system policy updates, unrestricted browsing or leaked secrets.
- [ ] The official trial starts **only by explicit CEO action** after readiness check, runs 168 hours and produces complete, honest exports + final report.


## 15. Owner-requested configuration decisions (14 October 2026)

1. **Multi-asset on day one, not crypto-only:** include US equities, ETFs, forex, crypto and commodity-linked ETFs. All five employees may trade all enabled classes; their research preferences may lead to specialisation. Unsupported derivatives remain off until a future explicit scoped approval.
2. **Internet on day one of the official trial, not during first development steps:** build five functional agents and validate autonomous multi-market paper trading **before** adding read-only web search. Then finish finance/news/filings/macro research tooling, citations, budgets and source UI **before the seven-day trial starts**. Research is a required first-trial feature, not optional future scope.
3. **Five OpenAI-powered traders** initially on the same affordable model, distinct personalities/approaches; later other providers/models may be added.
4. **Autonomous paper execution:** $1,000 simulated initial USD per agent; eligible orders automatically accepted and filled by trusted risk/ledger code, no per-trade owner sign-off. No real-money order path.
5. **One 7-day OFFICIAL trial**, started manually only after market feeds, web research, UI, scheduling, documentation and risk tests pass; exactly 168 hours on persisted UTC clock.
6. **$20 initial OpenAI API allowance** includes hosted `web_search` calls plus model tokens for build/tests/trial. Hosting and market-data subscriptions are **outside that $20**, requiring clear advance disclosure.
7. **First-class Messages + Research UI**, searchable complete agent-to-agent/CEO exchanges, sources and citations cross-linked to actual orders and evidence.
8. **YouTube-quality experimental record:** honest quotes and market status, source provenance, immutable decisions/trades, fees/slippage, daily results, costs, data anomalies, model/prompt hashes, replays and final benchmarks.
9. **Data-source feasibility is a go/no-go gate**, not a reason to silently revert to crypto-only. If data entitlement blocks a market, pause the official start and present the owner with specific options.


## 16. Documentation and YouTube research protocol

**Two-layer evidence:** engineering reproducibility and documentary narrative. The latter is drawn from the former, never staged.

### Required project docs

- `README.md`: purpose, setup, run/debug commands, environment variable **names only**, screenshots, current milestone.
- `docs/ARCHITECTURE.md`: this architecture, adapted to actual code, pinned upstream SHA and decisions.
- `docs/PROVIDER_DECISIONS.md`: equities, ETFs, FX, crypto and ETF commodity-proxy coverage with provider, endpoint, capability, timing, data cost/rights, latest 7-day eligibility checks and fallbacks.
- `docs/EXPERIMENT_PROTOCOL.md`: preregister hypotheses, exact market universe/currency, market sessions/DST, provider pricing modes, start/end rules, five roles/prompt hashes, web research/quotas, risk policy, FX conversion conventions, commissions/spread assumptions and benchmarks.
- `docs/AGENT_CARDS.md`: name, model/prompt version, desk, preferred market/strategy, all allowed instruments, research tools, search cap, memory behaviour.
- `docs/LOGBOOK.md`: factual dated bugs, outages, manually changed parameters, filming notes and references to event IDs.
- `docs/CHANGELOG.md`: technical and configuration revisions; separate pre-trial vs in-trial.
- `docs/REPORT_TEMPLATE.md`: results per asset class, return after fees, exposures, macro/news research quality, communications, costs, calendar closures, failure states, limitations.
- `docs/SECURITY.md`: auth, tool/Internet trust boundaries, feed credentials, paper/live boundary, incident response.

### Export/event schema

At minimum include `events.jsonl`, `messages.jsonl`, `messages.csv`, `trades.csv`, `fx_conversions.csv`, `positions.csv`, `daily_equity.csv`, `asset_exposure.csv`, `market_status.jsonl`, `research_queries.jsonl`, `research_sources.csv`, `decision_sources.jsonl`, `model_and_search_usage.csv`, `incidents.csv`, `benchmarks.csv`, `metrics.json`, `report.md`, `run_manifest.json` and a data dictionary.

For **each order**, reconstruct the full record: timestamp of web claim + source URL/publisher/postedAt/retrievedAt, quote/candle timestamp, instrument class and exchange state, order request, risk decision, next-quote fill, actual paper commissions/spread/slippage, resulting multi-currency ledger posting and eventual result. A cited web source may have been irrelevant or false; presence of a citation must not be portrayed as validating the trade.

Daily UTC summary: holdings/equity and benchmark across classes, fees, fills/rejections, FX cash, research count + claimed topics + source types, OpenAI search/token expenses, internal collaboration, market closures, incidents and manual intervention. Highlight candidates are editorial suggestions, not manufactured transcripts. Event replay shows recorded state and genuine agent messages; don't display hidden chain-of-thought or imply unobserved motivations. Clearly watermark **PAPER TRADING — SIMULATED RETURNS** on footage/screenshots/graphs.

### Experimental questions

1. Do different agents **develop asset-class specialities** with open access to the same instruments? Are market choices linked to strategy or communication?
2. Does any strategy beat mixed-asset passive basket, its relevant class benchmark and USD cash after synthetic costs and FX effects?
3. Do agents use web research well, distinguish news recency/reliable primary sources, and link citations to actual changes in decisions? Do they fall for stale/hype news?
4. Does dialogue influence distinct allocations? Use explicit message/decision links to show influences only when recorded.
5. How did differing market sessions affect opportunities and seven-day outcomes? Did stock positions simply sit idle over weekends?
6. What were the true OpenAI model and search tool costs, data/hosting costs, outages, human interventions and study limitations?

Do not overstate profitability or causal evidence from a seven-day small-sample study. Review art/audio/source licensing before publishing YouTube footage. News/source summaries must respect copyright and attributed display requirements.


## 17. Start-of-trial readiness and seven-day closeout

**Preflight gates — all green, or the official experiment cannot start (unless owner explicitly approves a new versioned scope):**

- Fork pinned/reproducible, five employees and CEO auth working; no browser required for autonomous scheduler.
- Provider audit covers **all required first-trial markets:** at least one instrument from US shares, index ETFs, commodity-linked ETFs, forex and crypto is available with adequate timestamped quotes/eligible market sessions; price source and rights documented.
- Exchange calendars verified for upcoming trial including weekend, US holidays/early closes and timezone/DST. Market-closed states distinct from data failures; open-session quote freshness and fills tested.
- Corporate-action and dividend policy implemented/documented for enabled securities/ETFs.
- Multi-currency ledger reconciliation and simulated long equity/crypto, ETF trades and unlevered FX conversions pass scripted tests. No real-money execution path or live brokerage order keys exist.
- Each agent can successfully perform **an internet research task and store clickable source provenance**, then use a typed quote/candle tool and create a HOLD or autonomous paper proposal; web-search usage/cost metering works.
- `Messages` and `Research` views, CEO chat, search, trades/decision deep links and exports function.
- $20 OpenAI/model+web-tool best-effort budget checks, incident alerts and stop control verified; separately record any market-data or hosting charges and require owner approval before starting any paid tier.
- Initial agent prompts/specialisations, full market universe, fee/spread assumptions, exchange provider IDs, base currency, mixed-asset benchmark, web-research quota and risk caps frozen as a hashed `EXPERIMENT_PROTOCOL.md` manifest.
- Complete an unattended **TEST** run containing at least a session change and a weekend/closed-market test (via controlled clock if needed). Test final export/report generation.

CEO presses **Start Experiment** once approved. Record exact immutable UTC start and planned end, protocol hash, enabled instrument list, provider entitlement snapshot, model IDs, capital funding, budget counters and code commit. At exactly **168 hours**, stop **new proposals/fills**, record remaining positions and independent mark valuations with quote-timestamps and market-open/closed labels, generate report and exports. Preserve outages/errors and disclose any unresolved price marks. Do not pretend closed exchanges were executable at seven-day close or liquidate open positions at fictitious weekend prices.


## Primary sources and implementation checks

Last public documentation review: 14 October 2026. Codex must verify market-feed provider access and calendars in Phase 0, model compatibility in Phase 3 and web-search API details in Phase 4; **the documents do not assert that accounts or paid feeds have been provisioned**.

- AI Town repository/idle pause: https://github.com/a16z-infra/ai-town
- AI Town architecture: https://github.com/a16z-infra/ai-town/blob/main/ARCHITECTURE.md
- OpenAI Agents SDK (TypeScript): https://openai.github.io/openai-agents-js/
- OpenAI hosted web search + citations: https://developers.openai.com/api/docs/guides/tools-web-search
- OpenAI API pricing including web-search call charges: https://developers.openai.com/api/docs/pricing
- OpenAI GPT-6 Luna page: https://developers.openai.com/api/docs/models/gpt-6-luna
- Convex scheduling: https://docs.convex.dev/scheduling/overview
- Twelve Data multi-asset coverage/limits: https://twelvedata.com/pricing
- Alpaca data plans, IEX vs SIP: https://docs.alpaca.markets/us/docs/about-market-data-api
- OANDA API practice environment: https://developer.oanda.com/rest-live-v20/development-guide/
- OANDA market session illustration (FX 24/5): https://www.oanda.com/us-en/trading/hours-of-operation/
- Kraken public API: https://docs.kraken.com/api/
- CCXT TypeScript/API documentation: https://github.com/ccxt/ccxt/wiki/manual
