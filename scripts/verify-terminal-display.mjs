import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

// Local integration check: briefly exercises both settings, always leaves prices off.
// Does not fetch providers, change execution rights, or create orders.
const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
const read = () => client.query(api.marketData.terminal, { clock: Date.now() });
try {
  await client.mutation(api.office.setTerminalPrices, { ownerToken, enabled: false });
  await assert.rejects(() =>
    client.mutation(api.office.setTerminalPrices, {
      ownerToken: 'invalid-observer-token',
      enabled: true,
    }),
  );
  const hidden = await read();
  assert.equal(hidden.pricesEnabled, false);
  assert.equal(hidden.rows.length, 14);
  assert(hidden.rows.every((row) => !row.quote || !('last' in row.quote)));
  await client.mutation(api.office.setTerminalPrices, { ownerToken, enabled: true });
  const otherClient = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
  const shown = await otherClient.query(api.marketData.terminal, { clock: Date.now() });
  assert.equal(shown.pricesEnabled, true);
  assert(shown.rows.every((row) => !row.quote || typeof row.quote.last === 'string'));
} finally {
  await client.mutation(api.office.setTerminalPrices, { ownerToken, enabled: false });
}
assert.equal((await read()).pricesEnabled, false);
console.log(
  'PASS: observers cannot enable prices; disabled response omits prices; owner setting persists across clients; prices restored off. No provider calls or orders.',
);
