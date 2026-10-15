import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const file = '.office/provider-persistence.json';
const snapshot = process.argv.includes('--snapshot');
const saved = JSON.parse(
  readFileSync(snapshot ? '.office/provider-acceptance.json' : file, 'utf8'),
);
const data = await client.query(api.paper.dashboard, { clock: Date.now(), runId: saved.runId });
const run = data.runs[0];
assert(run && run.mode === 'PROVIDER' && run.status === 'PAUSED');
assert.equal(run.fills.length, 5);
assert(run.portfolios.every((account) => account.reconciled));
const financial = {
  runId: run._id,
  accounts: run.portfolios.map((account) => ({
    agentId: account.agentId,
    cash: account.cash,
    positions: account.positions,
    riskDay: account.riskDay,
    filledToday: account.filledToday,
    initialUsd: account.initialUsd,
    dailyBaselineUsd: account.dailyBaselineUsd,
  })),
  fills: run.fills,
  orders: run.orders,
  benchmark: { account: run.benchmark.account, legs: run.benchmark.legs },
};
if (snapshot) {
  writeFileSync(file, JSON.stringify(financial));
  console.log(
    'Saved private filled-provider TEST snapshot. Restart the same local backend, then run this script with --check. No provider requests or financial changes.',
  );
} else {
  assert.deepEqual(financial, saved);
  console.log(
    'PASS: all five filled provider portfolios, orders, fills, source clocks and benchmark acquisitions exactly match the pre-restart snapshot; ledgers reconcile.',
  );
}
