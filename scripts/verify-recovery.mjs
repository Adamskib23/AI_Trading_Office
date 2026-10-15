import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
if (process.argv.includes('--schedule')) {
  const checkId = randomUUID();
  const jobId = await client.mutation(api.paperFixtures.scheduleRecovery, { ownerToken, checkId });
  writeFileSync('.office/recovery-job.json', JSON.stringify({ jobId, checkId }));
  console.log(
    'Recovery fixture scheduled in Convex. This process now exits; no browser or provider requests required. Check with --scheduled-status after five seconds.',
  );
  process.exit(0);
}
if (process.argv.includes('--scheduled-status')) {
  const { jobId, checkId } = JSON.parse(readFileSync('.office/recovery-job.json', 'utf8'));
  const status = await client.query(api.paperFixtures.recoveryJobStatus, { ownerToken, jobId });
  assert.equal(status.state, 'success');
  const dashboard = await client.query(api.paper.dashboard, { clock: Date.now() });
  const run = dashboard.runs.find((row) => row.label === `RECOVERY FIXTURE ${checkId}`);
  assert(run && run.mode === 'FIXTURE' && run.status === 'COMPLETED');
  assert.equal(run.incidents.length, 1);
  assert.equal(run.fills.length, 0);
  console.log(
    'PASS: durable scheduled recovery completed after the initiating process exited; one isolated fixture incident and no fills. This is not a backend restart or full unattended soak test.',
  );
  process.exit(0);
}
const result = await client.mutation(api.paperFixtures.runRecoveryScenario, { ownerToken });
assert.equal(result.source, 'FIXTURE');
assert.equal(result.expiryPassed, true);
assert.equal(result.discrepancyDetected, true);
assert.equal(result.incidents, 1);
assert.equal(result.fills, 0);
console.log(JSON.stringify(result));
console.log(
  'PASS: exact-deadline expiry; retry idempotency; mismatch pauses account and cancels pending order without a later quote; one persisted incident; no fill postings. Intentional corrupt fixture retained separately.',
);
