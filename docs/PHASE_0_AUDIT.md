# Phase 0 repository audit

Date: 14 October 2026. Scope: baseline setup, source audit and provider feasibility only.
Status: source audit and static checks completed; runtime verification recorded separately below. Phase 1 is not authorised.

## Baseline and document authority

- Upstream: https://github.com/a16z-infra/ai-town
- Pinned baseline: `8e05997f2409275669c8344b84a51692e83f3f33` (25 August 2026).
- Local checkout: `ai-town/` under the supplied workspace. This is a clone, not an owner-account GitHub fork; no remote writes or commits were made.
- `docs/ARCHITECTURE.md` is an unchanged copy of the supplied v0.4 specification. `CODEX_KICKOFF.md` is the supplied v0.4 kickoff. These supersede v0.2/v0.3 IDE tab references.
- Root `ARCHITECTURE.md` and `README.md` remain upstream documentation. The handoff README references a `docs/` directory inside its package, but the supplied architecture was actually at package root; copied into the prescribed checkout location.
- No AGENTS.md found in the checkout. No application source or dependency versions changed.
- Model IDs, model pricing and research-tool compatibility in the supplied specification are unverified candidates. Verify in Phase 3/4; they are not established capabilities or a setup budget forecast.

## Source structure and actual behaviour

| Location | Responsibility |
| --- | --- |
| `src/components/` | React office/town view, Pixi map, viewport, avatars, messages, human interaction |
| `src/hooks/` | Convex queries/input handling, browser world heartbeat, historical position playback |
| `convex/engine/` | Abstract simulation, input queue, engine schema, numeric history compression |
| `convex/aiTown/` | World/player/conversation rules, pathfinding, agents, operation dispatch and archives |
| `convex/agent/` | Conversation prompts, memory retrieval/summarisation/reflection, embedding cache |
| `convex/util/llm.ts` | Handwritten HTTP chat-completion/embedding client, streaming parser, retries, provider configuration |
| `convex/schema.ts`, `world.ts`, `messages.ts` | Durable tables, real-time queries and public mutations |
| `convex/init.ts`, `testing.ts`, `crons.ts` | Initialisation, developer utilities, world watchdog and retention |
| `data/`, `public/assets/`, `src/editor/` | Character descriptions/sprites, map, bundled art and existing editor |

Stack: React 18.2, TypeScript 5.1.3, Pixi 7, Vite 4, Convex 1.41.0 (locked install), optional but currently disabled Clerk integration, Jest/ts-jest, Tailwind. No Agents SDK or financial subsystem exists upstream. Lockfile, rather than package.json caret ranges, governs the installed baseline.

### Engine, movement and synchronisation

`Game` extends `AbstractGame`. It advances in 16 ms ticks, batches state persistence in 1,000 ms steps, and executes successive steps within scheduled 30-second actions. It loads compact world state, processes numbered input rows, simulates pathfinding/positions/conversations/agents, then applies a diff through a Convex mutation. Generation numbers invalidate obsolete runners. Engine-owned state must be modified through inputs, not direct writes from future trading actions.

Movement uses grid neighbours and heap-based route search, collision checks, timeout and random backoff. At most 16 path searches occur per step. Sprites and facing follow server positions. Numeric historical buffers replay positions smoothly in React/Pixi, while regular Convex subscriptions update descriptions and messages. This history is a short interpolation mechanism, not a durable documentary replay system.

### Characters and agents

Character metadata comes from `data/characters.ts`; `init` creates agents using those descriptions unless a `numAgents` override is supplied. Five named trading employees are future configuration, not existing identities.

`Agent.tick` is a state machine. It waits for one in-progress operation, expires it after 120 seconds, chooses activities/wandering, invites another free player, walks toward them, takes turns and remembers completed conversations. `agentDoSomething` is largely rules/randomness, not an LLM planner. External work is dispatched to internal Convex actions and its completion returns through engine inputs with operation IDs.

Default provider is local Ollama (`llama3`, `mxbai-embed-large`, 1,024-dimensional vectors). OpenAI support is the legacy chat-completions protocol and needs an embedding-dimension change. It is not the approved future trading runtime. Starting upstream default `npm run dev` invokes `predev`, which runs `init` and can start social AI work immediately. Therefore use separate backend/frontend commands for controlled setup.

### Conversations and memory

Native conversations are two-party and each player participates in at most one at a time. Membership progresses through invited, walkingOver and participating. Typing state, cooldowns and conversation length govern message generation. Messages live separately from the simulation in `messages`, indexed by world/conversation and message UUID. Completed conversations and participant relationships are archived. There is no global searchable message centre or group-channel system.

Conversation summaries, importance scores and embeddings are persisted; retrieval combines relevance, recency and importance, with three selected memories after overfetching. Reflection can trigger additional model work. Embeddings are cached by text hash. The pinned commit puts recalled memories in an explicitly untrusted user-role data message and includes tests for this. Budgeting must cover memory/embedding/reflection work as well as trading decisions.

### Database and scheduling

Convex queries provide reactive subscriptions; mutations are transactional; actions perform external requests and use mutations to persist results. Active world/player/conversation/agent arrays share a compact world document, while maps, descriptions, messages and memories are separate tables. Archived entities and the participatedTogether graph retain past relationships.

Crons check inactive worlds every five minutes, recover dead running worlds every minute, and vacuum old entries daily at 04:20 UTC. Browser heartbeats refresh lastViewed approximately every minute. A world becomes eligible for pause after five minutes without viewing; the five-minute scan means actual pause can occur later. Resuming advances its clock to the present and skips the paused interval.

## Retain, adapt, remove from future execution path

| Component | Decision and reason |
| --- | --- |
| React/Pixi map, viewport, sprites, pathfinding, interpolation | Retain; adapt map and five avatar identities in Phase 1 |
| Convex schema/query/mutation/action/subscription infrastructure | Retain; add financial records in separate domain tables |
| Compact game engine/input queue | Retain for visual world; never make financial execution depend on avatar movement or heartbeat |
| Existing message records and conversation IDs | Retain and extend; avoid a second competing transcript authority |
| Two-party embodied conversations | Adapt for authentic contacts; add explicit channels and searchable indexes in Phase 5 |
| Memory and embedding cache | Adapt with evidence IDs, scopes, prompt versions and budget admission |
| Unbounded social cadence, leisure activities, original personas | Replace/adapt in later phases with bounded genuine office activity |
| Legacy LLM client | Keep for baseline; introduce approved trading runtime and cost guard in Phase 3 |
| Public multiplayer, music/art generation, wipe/reset utilities | Keep baseline files; exclude from normal future office operations and owner-public API surface |

These are implementation recommendations consistent with v0.4, not code changes or revised approval.

## Limitations and security findings

1. **24/7 operation:** social agents depend on a world that pauses without the browser. Independent persisted financial jobs are required; keeping a browser tab open is not a solution.
2. **Authorisation:** Clerk provider and `ctx.auth.getUserIdentity()` checks are commented out. `joinWorld` uses the shared identity `Me`. `sendWorldInput` and `aiTown/main.sendInput` accept generic input arguments; `messages.writeMessage` accepts supplied sender/conversation without authenticating the caller or checking membership before insertion. Public stop/resume are not owner-authenticated. These are confirmed source gaps, not an exploit test. Never expose this baseline as the CEO office.
3. **Financial correctness:** no portfolios, multicurrency ledger, decimal authority, calendars, quote provenance, broker, risk checks, budgets or experiment lifecycle exists. Simulation numeric buffers are unsuitable as ledger authority.
4. **Recovery:** existing operation IDs/watchdog are useful but do not establish exactly-once model calls, order proposals or ledger fills. Add durable leases, bounded retries and financial idempotency tests.
5. **Cost:** normal conversation cadence can make frequent inference, memory and embedding calls. Existing HTTP client does not enforce the project's $20 budget or persist complete usage accounting.
6. **Evidence retention:** vacuum removes inputs, memories and memoryEmbeddings older than 14 days. Messages are not currently in its removal list. Do not use transient position history or a wipe utility as an official replay/export store. Memory filters use player IDs; experiment/world scope needs review before retaining multiple experiments.
7. **Scale:** the whole active world is loaded per step and mutated through one world runner. Keep quotes, ledger, research and audit history outside this hot document. One-second visual writes can consume hosting quota even with five avatars.
8. **Hosting:** local backend stops when its process stops; sleep/reboot/network loss affect local development. Use always-available deployment and monitored schedules for the official run.
9. **Licensing:** source is MIT; retain copyright/license. README credits third-party art and generated media, which are not automatically licensed under MIT. Verify each asset's source, terms and attribution before public deployment or YouTube footage. Asset-level rights audit remains open.

## Verification record

- Git 2.52.0.windows.1, Node 24.13.1, npm 11.8.0 verified. `npm.ps1` is blocked by PowerShell policy; `npm.cmd` works without changing policy.
- No Docker or Ollama command found on PATH. Python resolves to the WindowsApps launcher; an actual Python installation was not confirmed and was not needed for these checks.
- Clone succeeded through approved network access; SHA recorded above.
- `npm.cmd ci --ignore-scripts --no-audit --no-fund`: 748 packages installed; lockfile unchanged. Lifecycle scripts disabled deliberately.
- `npm.cmd run build`: passes. Initial sandbox attempt caused esbuild access-denied/crash; approved retry passes unchanged. Warnings: outdated browserslist and >500 kB frontend bundle.
- Windows-safe Jest command: `$env:NODE_OPTIONS='--experimental-vm-modules'; node node_modules\jest\bin\jest.js --runInBand --verbose`: **7 suites, 53 tests pass**. Existing tests cover geometry/compression/history/heap/types/async map and recalled-memory trust; they do not prove backend auth, trading or unattended operation.
- `npm.cmd run lint`: **0 errors, 96 upstream warnings**. No mass cleanup in Phase 0.
- Runtime and dependency audit results: see `PHASE_0_RUNTIME.md`.
- No paid model requests, provider subscriptions, broker order calls, agent trading loops or official experiment started.

## Phase 0 exit checkpoint

Before declaring Phase 0 fully complete: verify local backend + frontend together, human movement/refresh persistence, and document a permitted no-billable baseline strategy. Local social LLM conversation is optional setup validation only after explicit model-call permission. Credentialed provider access/rights gaps are recorded in PROVIDER_DECISIONS; no required asset class is silently removed. Owner reviews this audit and plan before Phase 1.
