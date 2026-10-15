import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

// Default is read-only. --run uses only the existing gated paper engine, never
// attests to rights, changes risk policy, or starts the official experiment.
const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const required = ['us:AAPL', 'us:SPY', 'us:GLD', 'fx:EUR/USD', 'kraken:BTC/USD'];
async function readiness() {
  const clock = Date.now();
  const [feeds, office] = await Promise.all([
    client.query(api.marketData.status, { clock }),
    client.query(api.office.overview, { clock }),
  ]);
  assert(office, 'Office unavailable');
  return feeds.rows.map((row) => {
    const instrument = office.instruments.find((item) => item.id === row.instrumentId);
    const cap = row.capability;
    const gates = [];
    if (!row.configured) gates.push('CREDENTIAL_REQUIRED');
    if (!instrument?.selected) gates.push('INSTRUMENT_DISABLED');
    if (!row.quote || !cap?.quoteVerified || !cap?.candlesVerified)
      gates.push('QUOTE_CANDLE_EVIDENCE_REQUIRED');
    if (!cap?.rightsVerified) gates.push('DATA_RIGHTS_REVIEW_REQUIRED');
    if (!cap?.sessionVerified) gates.push('SESSION_REVIEW_REQUIRED');
    if (cap?.sourceMode !== 'live') gates.push('LIVE_SOURCE_REVIEW_REQUIRED');
    if (instrument?.assetClass === 'stock' || instrument?.assetClass === 'etf') {
      if ((cap?.corporateActionsClearUntil ?? 0) < office.asOf)
        gates.push('CORPORATE_ACTION_REVIEW_REQUIRED');
    }
    if (instrument?.session.state === 'CLOSED') gates.push('MARKET_CLOSED');
    if (instrument?.session.state === 'UNVERIFIED' && instrument.assetClass !== 'fx')
      gates.push('CALENDAR_UNVERIFIED');
    if (
      row.quote &&
      (row.quote.sourceTimestamp > row.quote.retrievedAt || row.quote.retrievedAt > office.asOf)
    )
      gates.push('INVALID_QUOTE_TIME');
    if (row.quote && office.asOf - row.quote.sourceTimestamp > 120_000) gates.push('QUOTE_STALE');
    if (
      row.quote &&
      (!row.quote.healthy || row.quote.delayMs !== 0 || row.quote.sourceMode !== 'live')
    )
      gates.push('QUOTE_NOT_LIVE_HEALTHY');
    return { row, instrument, gates };
  });
}

let assessment = await readiness();
for (const { row, gates } of assessment)
  console.log(
    JSON.stringify({
      symbol: row.symbol,
      sourceTimestamp: row.quote?.sourceTimestamp ?? null,
      quoteAndCandlesReceived: !!row.capability?.quoteVerified && !!row.capability?.candlesVerified,
      gates,
      requiredForAcceptance: required.includes(row.instrumentId),
    }),
  );
if (!process.argv.includes('--run')) {
  console.log(
    'Read-only readiness report. No provider requests, accounts, orders or reviews created. --run is available once documented rights/session/source/corporate-action reviews and market hours permit.',
  );
  process.exit(0);
}
const structural = assessment
  .filter(({ row }) => required.includes(row.instrumentId))
  .flatMap(({ row, gates }) =>
    gates
      .filter((gate) => !['QUOTE_STALE', 'QUOTE_NOT_LIVE_HEALTHY'].includes(gate))
      .map((gate) => `${row.symbol}: ${gate}`),
  );
if (structural.length) {
  console.log(`BLOCKED: ${structural.join('; ')}. No orders or provider requests made.`);
  process.exitCode = 2;
} else {
  const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
  for (const instrumentId of required) {
    const result = await client.action(api.marketData.refresh, { ownerToken, instrumentId });
    assert.equal(
      result.status,
      'RECEIVED',
      `${instrumentId}: refresh failed; do not bypass cooldown`,
    );
  }
  assessment = await readiness();
  const pending = assessment.filter(({ row }) => required.includes(row.instrumentId));
  assert(
    pending.every(({ gates }) => !gates.length),
    'Fresh execution evidence not ready; no run created',
  );
  const runId = await client.mutation(api.paper.createRun, {
    ownerToken,
    label: 'SCRIPTED PROVIDER ACCEPTANCE — NOT OFFICIAL',
  });
  try {
    const cycleId = randomUUID();
    const employees = ['alex', 'oliver', 'nina', 'sophie', 'marcus'];
    for (const [index, instrumentId] of required.entries()) {
      const feed = pending.find(({ row }) => row.instrumentId === instrumentId);
      const fx = instrumentId === 'fx:EUR/USD';
      const proposal = {
        agentId: employees[index],
        cycleId,
        proposalIndex: 0,
        instrumentId,
        action: fx ? 'CONVERT_CURRENCY' : 'BUY',
        ...(fx
          ? { fromCurrency: 'USD', toCurrency: 'EUR', amountFrom: '100' }
          : {
              quantity: new Decimal(100)
                .div(feed.row.quote.last)
                .toDecimalPlaces(feed.instrument.quantityPrecision, Decimal.ROUND_FLOOR)
                .toFixed(),
            }),
      };
      await client.mutation(api.paper.propose, { ownerToken, runId, proposal });
    }
    let run;
    for (let attempt = 0; attempt < 40; attempt++) {
      const dashboard = await client.query(api.paper.dashboard, { clock: Date.now() });
      run = dashboard.runs.find((item) => item._id === runId);
      assert(run, 'Acceptance run unavailable');
      if (run.orders.some((order) => order.status === 'REJECTED')) break;
      if (run.fills.length === 5) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    assert.equal(
      run.fills.length,
      5,
      `Expected five provider fills: ${run.orders.map((order) => order.reason).join(', ')}`,
    );
    assert.equal(run.portfolios.length, 5);
    assert.equal(run.orders.length, 5);
    assert(run.orders.every((order) => order.status === 'FILLED'));
    assert(run.portfolios.every((portfolio) => portfolio.reconciled));
    assert.equal(run.benchmark.legs.filter((leg) => leg.filledAt).length, 4);
    for (const fill of run.fills) {
      const order = run.orders.find((item) => item._id === fill.orderId);
      assert.notEqual(fill.quoteId, order.observedQuoteId);
    }
    console.log(
      JSON.stringify({
        runId,
        fills: 5,
        reconciledAccounts: 5,
        benchmarkSleeves: 4,
        source: 'ACTUAL PROVIDER DATA / SIMULATED EXECUTION',
      }),
    );
  } finally {
    await client.mutation(api.paper.setPaused, { ownerToken, runId, paused: true });
  }
}
