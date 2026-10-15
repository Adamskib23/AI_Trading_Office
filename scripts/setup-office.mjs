// Run with the local Convex backend active. Never prints the owner credential.
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
const env = readFileSync('.env.local', 'utf8');
if (!/^VITE_CONVEX_URL=["']?http:\/\/(127\.0\.0\.1|localhost):3210["']?\s*$/m.test(env))
  throw new Error('Refusing setup: expected the local Convex backend on port 3210');
mkdirSync('.office', { recursive: true });
const path = '.office/owner-token.txt';
const token = existsSync(path)
  ? readFileSync(path, 'utf8').trim()
  : randomBytes(32).toString('hex');
if (token.length < 32) throw new Error('Local owner token is invalid');
if (!existsSync(path)) writeFileSync(path, token + '\n', { mode: 0o600 });
for (const args of [
  ['env', 'set', 'OFFICE_PHASE', '1'],
  ['env', 'set', 'OFFICE_OWNER_TOKEN', token],
]) {
  const child = spawnSync(process.execPath, ['node_modules/convex/bin/main.js', ...args], {
    encoding: 'utf8',
  });
  if (child.status !== 0)
    throw new Error(`Local office setup step failed (${args[0]}). Check backend logs.`);
}
// Some Windows/Node versions abort the CLI on exit after a successful run.
// Verify the actual backend result rather than treating that exit as success.
spawnSync(process.execPath, ['node_modules/convex/bin/main.js', 'run', 'office:bootstrap'], {
  encoding: 'utf8',
});
const client = new ConvexHttpClient('http://127.0.0.1:3210');
const office = await client.query(api.office.overview, { clock: Date.now() });
if (!office || office.profiles.length !== 5) throw new Error('Office bootstrap was not confirmed');
await client.mutation(api.office.authenticate, { ownerToken: token });
console.log(
  'Phase 1 office configured. Model calls locked. Owner token: .office/owner-token.txt (not printed).',
);
