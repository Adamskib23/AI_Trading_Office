import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const file = '.office/day-boundary.json';
if (process.argv.includes('--start')) {
  const { runId } = JSON.parse(readFileSync('.office/provider-acceptance.json', 'utf8'));
  const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
  const dashboard = await client.query(api.paper.dashboard, { clock: Date.now(), runId });
  const run = dashboard.runs[0];
  if (!run) throw new Error('Verified acceptance run unavailable');
  if (run.dayCheckAt) throw new Error('Check already scheduled; use --status');
  const result = await client.mutation(api.paper.startDayBoundaryCheck, { ownerToken, runId });
  writeFileSync(file, JSON.stringify({ runId, stopAt: result.stopAt }));
  console.log(
    `Provider TEST resumed for bounded midnight validation. Automatic stop UTC: ${new Date(result.stopAt).toISOString()}. No model calls, research or new order proposals.`,
  );
}
if (!existsSync(file)) {
  console.log(
    'No actual-provider day-boundary check scheduled. --start requires a successful provider acceptance record.',
  );
  process.exit(2);
}
const { runId, stopAt } = JSON.parse(readFileSync(file, 'utf8'));
const dashboard = await client.query(api.paper.dashboard, { clock: Date.now(), runId });
const run = dashboard.runs[0];
if (!run) throw new Error('Day-boundary run unavailable');
const check = run.checks.find((item) => item.kind === 'ACTUAL_UTC_ROLLOVER');
console.log(
  JSON.stringify({
    runId,
    status: run.status,
    stopAtUtc: new Date(stopAt).toISOString(),
    stopAtLondon: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(stopAt),
    check: check
      ? {
          passed: check.passed,
          at: new Date(check.at).toISOString(),
          accounts: JSON.parse(check.details),
        }
      : 'PENDING — no pass claimed',
  }),
);
if (!check || !check.passed) process.exitCode = 2;
