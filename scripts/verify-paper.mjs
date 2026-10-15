import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
await assert.rejects(
  () => client.mutation(api.paperFixtures.runScenario, { ownerToken: 'invalid' }),
  /denied/,
);
const scenario = await client.mutation(api.paperFixtures.runScenario, { ownerToken });
assert.equal(scenario.fills, 5);
assert.equal(scenario.source, 'FIXTURE');
const data = await client.query(api.paper.dashboard, { clock: Date.now() });
const run = data.runs.find((r) => r._id === scenario.runId);
assert.equal(run.mode, 'FIXTURE');
assert.equal(run.fills.length, 5);
assert.equal(run.orders.length, 5);
assert(run.portfolios.every((p) => p.reconciled && p.mark.priced));
await assert.rejects(
  () =>
    client.mutation(api.paper.propose, {
      ownerToken,
      runId: run._id,
      proposal: {
        agentId: 'alex',
        cycleId: 'forged',
        proposalIndex: 0,
        instrumentId: 'us:AAPL',
        action: 'BUY',
        quantity: '1',
      },
    }),
  /Fixture/,
);
const feeds = await client.query(api.marketData.status, { clock: Date.now() });
assert(feeds.rows.every((row) => row.quote?.provider !== 'fixture'));
assert.equal(run.benchmark.legs.filter(l=>l.filledAt).length,4);
// Exercise real concurrent Convex transactions on a paused, unfed provider TEST.
// This checks idempotency without permitting ingestion or financial fills.
const providerRunId=await client.mutation(api.paper.createRun,{ownerToken,label:'Concurrency / fail-closed regression'});
await client.mutation(api.paper.setPaused,{ownerToken,runId:providerRunId,paused:true});
const proposal={agentId:'alex',cycleId:'concurrent',proposalIndex:0,instrumentId:'us:AAPL',action:'BUY',quantity:'1'};
const ids=await Promise.all(Array.from({length:4},()=>client.mutation(api.paper.propose,{ownerToken,runId:providerRunId,proposal})));
assert(ids.every(id=>id===ids[0]));
await assert.rejects(()=>client.mutation(api.paper.propose,{ownerToken,runId:providerRunId,proposal:{...proposal,quantity:'2'}}),/IDEMPOTENCY_CONFLICT/);
const verified=await client.query(api.paper.dashboard,{clock:Date.now()});
const paused=verified.runs.find(r=>r._id===providerRunId);
assert.equal(paused.orders.length,1);assert.equal(paused.orders[0].reason,'PAUSED');assert.equal(paused.fills.length,0);
assert(paused.portfolios.every(p=>p.reconciled&&p.cash.USD==='1000.00'));
console.log(
  JSON.stringify({
    runId: run._id,
    fills: run.fills.length,
    balancedAccounts: run.portfolios.filter((p) => p.reconciled).length,
    actualClasses: ['stock', 'broad ETF', 'commodity ETF', 'FX cash', 'crypto'],
    source: 'SCRIPTED FIXTURE ONLY',
    noProviderContamination: true,
    concurrentRetries:'4 requests, 1 rejected order, 0 postings beyond funding',
  }),
);
