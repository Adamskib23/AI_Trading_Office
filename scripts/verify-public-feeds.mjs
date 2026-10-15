import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
let blocked = false;
for (const symbol of ['BTC', 'ETH', 'SOL']) {
  const response = await client.action(api.marketData.refresh, {
    ownerToken,
    instrumentId: `kraken:${symbol}/USD`,
  });
  console.log(`${symbol}/USD: ${response.status}`);
  if (response.status !== 'RECEIVED') {
    blocked = true;
    break;
  }
}
const status = await client.query(api.marketData.status, { clock: Date.now() });
for (const row of status.rows.filter((row) => row.provider === 'kraken')) {
  console.log(
    JSON.stringify({
      symbol: row.symbol,
      event: row.event?.status,
      error: row.event?.message,
      diagnostic: row.event?.diagnostic,
      sourceTimestamp: row.quote?.sourceTimestamp,
      sourceMode: row.quote?.sourceMode,
      quoteVerified: row.capability?.quoteVerified,
      candlesVerified: row.capability?.candlesVerified,
      rightsVerified: row.capability?.rightsVerified,
      ageSeconds: row.quote ? Math.round((Date.now() - row.quote.sourceTimestamp) / 1000) : null,
    }),
  );
  if (row.quote) {
    assert.equal(row.quote.provider, 'kraken');
    assert.equal(row.capability?.candlesVerified, true);
  }
}
console.log(
  blocked
    ? 'Provider verification INCOMPLETE: inspect recorded errors; rejected data was not used for fills.'
    : 'All public crypto quote/candle checks received data; execution remains subject to the recorded scoped review and risk gates.',
);
