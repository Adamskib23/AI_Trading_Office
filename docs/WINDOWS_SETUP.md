# Windows baseline setup (Phase 0)

**Historical Phase 0 instructions. Phase 1 is now installed:** use [PHASE_1.md](PHASE_1.md) and `Start-Office.cmd`. Do not initialise the old baseline again. The original town is preserved as a separate non-default world.

The checkout is already installed at `C:\Users\maxjt\Documents\personal\AI_Trading_Office\ai-town`. Use PowerShell and `.cmd` wrappers; changing execution policy is unnecessary. Local Convex requires no account for this baseline and can reach a future local Ollama server without a public tunnel.

## Open the running baseline

Visit **http://127.0.0.1:5173/ai-town/** in your browser. Local backend: `http://127.0.0.1:3210`. The map is initialised, with a human player used for the movement check and **zero AI agents**. This is the original renderer/engine running without model calls; it is not yet a working autonomous AI town. No API key is needed for this safe baseline.

Backend and frontend were started during Phase 0. If they have stopped, use two terminals:

Terminal 1:

```powershell
cd C:\Users\maxjt\Documents\personal\AI_Trading_Office\ai-town
$env:CONVEX_AGENT_MODE='anonymous'
node node_modules\convex\bin\main.js dev --tail-logs disable
```

Terminal 2:

```powershell
cd C:\Users\maxjt\Documents\personal\AI_Trading_Office\ai-town
npm.cmd run dev:frontend -- --host 127.0.0.1
```

Keep terminal 1 running: the local database service/scheduler stops when its process stops. Data persists in the ignored `.convex/` directory. Do not delete it or run a wipe command. Development env selection is in ignored `.env.local` (`CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`); these frontend URL values are not AI secrets.

For a fresh local database only, after terminal 1 reports functions ready:

```powershell
node scripts\phase0-smoke.mjs init
node scripts\phase0-smoke.mjs status
```

`init` uses upstream's numAgents override to create zero agents. Never run it against an existing populated AI deployment expecting it to disable agents. The status command is read-only. `move` joins a human and moves to an adjacent free tile; run once on an empty human-player world or leave through the UI first.

Avoid `npm.cmd run dev` for now: its `predev` automatically runs default `init`, which creates social agents and can invoke configured models. Separate commands bypass that automatic initialisation. No paid provider key was set in this new local deployment.

## Manual browser verification still needed

1. Confirm the original map and human avatar render with no console errors.
2. Interact/join if not already present, click a reachable tile and watch movement/collisions.
3. Refresh and confirm server-backed position remains available.
4. Close the browser: world becomes eligible for idle pause after five minutes, with the five-minute cron determining the eventual pause. Reopen and verify heartbeat resumes it.

HTTP/module and backend movement checks passed during setup; visual rendering and browser interaction have not been witnessed by Codex. Original social conversation/memory is deliberately untested because it invokes a model.

## Original social AI baseline: next setup choice

To test upstream social AI without API fees, install local [Ollama](https://ollama.com/) and download the upstream default chat and embedding models (`llama3`, `mxbai-embed-large`). This requires disk/RAM/download capacity; hardware capacity has not been audited. Ollama was not found on PATH. No model installation or inference was performed. After the owner permits model execution, verify local inference and then explicitly initialise upstream agents. This remains baseline validation, separate from configuring the five trading employees in Phase 3.

Using an OpenAI key for upstream social AI requires explicit billable-call authorisation and an embedding dimension/schema decision. No key is requested now. Never paste secrets into chat or `VITE_` variables. Enter backend keys through the secret store locally when needed.

## Reproducible verification commands

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run build
npm.cmd run lint
$env:NODE_OPTIONS='--experimental-vm-modules'
node node_modules\jest\bin\jest.js --runInBand --verbose
Remove-Item Env:NODE_OPTIONS
```

Upstream `npm test` uses POSIX environment assignment and does not work as written in Windows cmd. The command above uses the same Jest configuration. The upstream README's WSL/Node 18 instructions are historical; Node 24.13.1 successfully built/tested here. No need to reinstall Node or add WSL merely for the checks already passing. Local Node-runtime actions may have additional runtime requirements; audit if introduced later.

If Vite reports another port, use its printed URL. A missing `VITE_CONVEX_URL` means backend configuration hasn't completed. A CLI JSON invocation crashed with a Windows libuv assertion during this audit; the included Node smoke script passes structured arguments through ConvexHttpClient instead. A raw HTTP check without an HTML Accept header can get a Vite 404 on the SPA path; browser-style HTML requests work.

No public deployment, account provisioning, paid service or later-phase implementation is part of these instructions.
