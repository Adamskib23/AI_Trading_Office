import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
const instruments = [
  'us:AAPL',
  'us:MSFT',
  'us:NVDA',
  'us:SPY',
  'us:QQQ',
  'us:GLD',
  'us:SLV',
  'us:USO',
  'fx:EUR/USD',
  'fx:GBP/USD',
  'fx:USD/JPY',
];
const representative = ['us:AAPL', 'us:SPY', 'us:GLD', 'fx:EUR/USD'];
const requested = process.argv.slice(2);
if (requested.some((id) => !instruments.includes(id)))
  throw new Error('Unknown verification instrument');
for (const instrumentId of requested.length ? requested : representative) {
  const result = await client.action(api.marketData.refresh, { ownerToken, instrumentId });
  console.log(`${instrumentId}: ${result.status}`);
  if (result.status !== 'RECEIVED') break; // Honour provider cooldown; no retry loop.
}
const status = await client.query(api.marketData.status, { clock: Date.now() });
for (const row of status.rows.filter((row) =>
  (requested.length ? requested : representative).includes(row.instrumentId),
)) {
  console.log(
    JSON.stringify({
      symbol: row.symbol,
      configured: row.configured,
      event: row.event?.status ?? 'NOT_FETCHED',
      result: row.event?.message ?? null,
      diagnostic: row.event?.diagnostic ?? null,
      sourceTimestamp: row.quote ? new Date(row.quote.sourceTimestamp).toISOString() : null,
      quoteVerified: row.capability?.quoteVerified ?? false,
      candlesVerified: row.capability?.candlesVerified ?? false,
      rightsVerified: row.capability?.rightsVerified ?? false,
      sourceMode: row.quote?.sourceMode ?? null,
    }),
  );
}
