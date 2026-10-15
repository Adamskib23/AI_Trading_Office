import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

// Keep secrets out of the caller's environment, CLI arguments and command output.
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const secretFile = '.secrets.env';
const ignored = spawnSync('git', ['check-ignore', '--quiet', secretFile]);
const tracked = spawnSync('git', ['ls-files', '--error-unmatch', secretFile], { stdio: 'ignore' });
if (ignored.status !== 0 || tracked.status === 0)
  throw new Error('Refusing import: .secrets.env must be Git-ignored and untracked.');
const deployment = parse(readFileSync('.env.local', 'utf8'));
if (
  !/^http:\/\/(127\.0\.0\.1|localhost):3210\/?$/.test(deployment.VITE_CONVEX_URL ?? '') ||
  !deployment.CONVEX_DEPLOYMENT?.startsWith('anonymous:') ||
  deployment.CONVEX_SELF_HOSTED_URL
)
  throw new Error('Refusing import: expected the existing anonymous local Convex deployment.');
const values = parse(readFileSync(secretFile, 'utf8'));
if (Object.keys(values).some((name) => name.startsWith('VITE_')))
  throw new Error('Client-prefixed variables are forbidden in the secrets file.');
// Phase 2 explicitly allows only its data key to be loaded. Future keys can be
// stored locally but remain disconnected until their phase and spend authorisation.
const allowed = ['TWELVE_DATA_API_KEY'];
const selected = allowed.filter((name) => values[name]?.trim());
if (!selected.length)
  throw new Error(
    'No configured Phase 2 data key found. Fill TWELVE_DATA_API_KEY in .secrets.env.',
  );
if (process.argv.includes('--check')) {
  console.log(
    'Secrets file is ignored and untracked; local target verified; Phase 2 data key is present. No secrets imported or API calls made.',
  );
} else {
  const childEnv = { ...process.env, ...deployment };
  for (const name of [
    'CONVEX_DEPLOY_KEY',
    'CONVEX_SELF_HOSTED_URL',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
  ])
    delete childEnv[name];
  for (const name of selected) {
    const child = spawnSync(
      process.execPath,
      ['node_modules/convex/bin/main.js', 'env', 'set', name],
      {
        input: values[name] + '\n',
        encoding: 'utf8',
        env: childEnv,
      },
    );
    // Never forward CLI stdout/stderr: provider values could appear in diagnostics.
    if (child.status !== 0)
      throw new Error(
        'Secret import failed. Ensure the local backend is running. No values were printed.',
      );
    console.log(`Loaded ${name} into the local backend. Value hidden.`);
  }
  console.log('Future-phase keys were not loaded. No model or market-data requests were made.');
}
