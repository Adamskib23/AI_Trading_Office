import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const required = ['us:AAPL', 'us:SPY', 'us:GLD'];
const wait = process.argv.includes('--wait');
let office;
for (let attempt = 0; attempt < (wait ? 120 : 1); attempt++) {
  office = await client.query(api.office.overview, { clock: Date.now() });
  assert(office, 'Office unavailable');
  if (
    required.every(
      (id) => office.instruments.find((item) => item.id === id)?.session.state === 'OPEN',
    )
  )
    break;
  if (wait) await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert(
  required.every(
    (id) => office.instruments.find((item) => item.id === id)?.session.state === 'OPEN',
  ),
  'US regular session closed; no provider requests made',
);
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
for (const instrumentId of required) {
  const result = await client.action(api.marketData.refresh, { ownerToken, instrumentId });
  assert.equal(result.status, 'RECEIVED', `${instrumentId}: bounded source check failed`);
}
const data = await client.query(api.marketData.status, { clock: Date.now() });
const now = Date.now();
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).formatToParts(now);
const nyMinute =
  Number(parts.find((part) => part.type === 'hour').value) * 60 +
  Number(parts.find((part) => part.type === 'minute').value);
const openingAt = Math.floor(now / 60_000) * 60_000 - (nyMinute - 570) * 60_000;
const evidence = [];
for (const row of data.rows.filter((item) => required.includes(item.instrumentId))) {
  const quote = row.quote,
    cap = row.capability;
  assert(quote && cap?.quoteVerified && cap.candlesVerified);
  assert(
    quote.sourceTimestamp >= openingAt,
    `${row.symbol}: no quote from the current regular session`,
  );
  assert(
    now - quote.sourceTimestamp >= 0 && now - quote.sourceTimestamp <= 120_000,
    `${row.symbol}: source is not fresh`,
  );
  evidence.push({
    instrumentId: row.instrumentId,
    sourceTimestamp: quote.sourceTimestamp,
    retrievedAt: quote.retrievedAt,
    ageSeconds: (now - quote.sourceTimestamp) / 1000,
  });
}
assert.equal(evidence.length, 3);
if (process.argv.includes('--review')) {
  for (const row of data.rows.filter((item) => required.includes(item.instrumentId))) {
    const cap = row.capability;
    assert(
      cap.rightsVerified && cap.sessionVerified && cap.corporateActionsClearUntil > now,
      'Prior rights/session/corporate review required',
    );
    await client.mutation(api.marketData.review, {
      ownerToken,
      instrumentId: row.instrumentId,
      reference: `${new Date(now).toISOString()}: docs/PHASE_2_ACCEPTANCE.md; Twelve Data Basic real-time reference quote observed in current US regular session within 120s, closed raw candles verified. No SIP/NBBO/firm broker quote claim. Existing internal rights and bounded corporate/session review retained.`,
      rightsVerified: cap.rightsVerified,
      sessionVerified: cap.sessionVerified,
      sourceMode: 'live',
      corporateActionsClearUntil: cap.corporateActionsClearUntil,
    });
  }
}
writeFileSync(
  '.office/open-session-evidence.json',
  JSON.stringify({
    checkedAt: now,
    openingAt,
    reviewed: process.argv.includes('--review'),
    rows: evidence,
  }),
);
console.log(
  JSON.stringify({
    source: 'ACTUAL OPEN-SESSION PROVIDER DATA',
    reviewed: process.argv.includes('--review'),
    rows: evidence,
  }),
);
console.log(
  'No orders created. Refresh after source review before acceptance; unchanged quote IDs retain their original recorded mode.',
);
