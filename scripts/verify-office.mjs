import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
const client = new ConvexHttpClient('http://127.0.0.1:3210', { logger: false });
const ownerToken = readFileSync('.office/owner-token.txt', 'utf8').trim();
const overview = () => client.query(api.office.overview, { clock: Date.now() });
const office = await overview();
assert.equal(office.profiles.length, 5);
assert.equal(office.setup.phase, 'SETUP');
assert(office.profiles.every((p) => !p.enabled));
assert.equal(office.instruments.length, 14);
assert(office.instruments.every((i) => i.entitlement === 'UNVERIFIED'));
const status = await client.query(api.world.defaultWorldStatus, {});
const worldId = office.setup.worldId;
await client.mutation(api.world.heartbeatWorld, { worldId });
const state = () => client.query(api.world.worldState, { worldId });
for (let i = 0; i < 40 && (await state()).world.players.length !== 5; i++)
  await new Promise((r) => setTimeout(r, 250));
assert.equal((await state()).world.players.length, 5);
assert.equal((await state()).world.agents.length, 0);
const denied = [
  [api.office.setPaused, { ownerToken: 'invalid', paused: true }],
  [
    api.office.selectInstrument,
    { ownerToken: 'invalid', instrumentId: 'us:AAPL', selected: false },
  ],
  [api.office.moveEmployee, { ownerToken: 'invalid', employeeId: 'alex', x: 5, y: 7 }],
  [api.world.joinWorld, { worldId }],
  [api.world.leaveWorld, { worldId }],
  [
    api.world.sendWorldInput,
    {
      engineId: status.engineId,
      name: 'moveTo',
      args: { playerId: 'p:0', destination: { x: 5, y: 7 } },
    },
  ],
  [api.aiTown.main.sendInput, { worldId, name: 'createAgent', args: { descriptionIndex: 0 } }],
  [
    api.messages.writeMessage,
    { worldId, conversationId: 'c:999', playerId: 'p:0', messageUuid: 'forged', text: 'forged' },
  ],
  [api.testing.stop, {}],
  [api.testing.resume, {}],
  [api.init.default, { numAgents: 5 }],
];
for (const [fn, args] of denied)
  await assert.rejects(() => client.mutation(fn, args), /denied|authenticated|already initialised/);
await assert.rejects(
  () => client.mutation(api.office.moveEmployee, { ownerToken, employeeId: 'alex', x: 5, y: 5 }),
  /empty floor/,
);
await client.mutation(api.office.authenticate, { ownerToken });
const instrument = office.instruments[0];
try {
  await client.mutation(api.office.selectInstrument, {
    ownerToken,
    instrumentId: instrument.id,
    selected: !instrument.selected,
  });
  assert.equal((await overview()).instruments[0].selected, !instrument.selected);
} finally {
  await client.mutation(api.office.selectInstrument, {
    ownerToken,
    instrumentId: instrument.id,
    selected: instrument.selected,
  });
}
await client.mutation(api.office.setPaused, { ownerToken, paused: true });
assert.equal((await state()).engine.running, false);
await client.mutation(api.world.heartbeatWorld, { worldId });
assert.equal((await state()).engine.running, false);
await client.mutation(api.office.setPaused, { ownerToken, paused: false });
const profile = office.profiles.find((p) => p.employeeId === 'alex');
const inputId = await client.mutation(api.office.moveEmployee, {
  ownerToken,
  employeeId: 'alex',
  x: 5,
  y: 7,
});
let result;
for (let i = 0; i < 40; i++) {
  result = await client.query(api.aiTown.main.inputStatus, { inputId });
  if (result) break;
  await new Promise((r) => setTimeout(r, 250));
}
assert.equal(result.kind, 'ok');
for (let i = 0; i < 40; i++) {
  const p = (await state()).world.players.find((p) => p.id === profile.playerId);
  if (p.position.y === 7) break;
  await new Promise((r) => setTimeout(r, 250));
}
const moved = (await state()).world.players.find((p) => p.id === profile.playerId);
assert.deepEqual(moved.position, { x: 5, y: 7 });
await client.mutation(api.office.moveEmployee, { ownerToken, employeeId: 'alex', x: 5, y: 6 });
assert.equal((await state()).world.agents.length, 0);
console.log(
  'PASS: 5 persistent avatars; 14 unverified instruments; 11 unauthorised/legacy routes denied; blocked desk rejected; selection persisted/restored; pause resists heartbeat; authenticated engine movement works. No model calls.',
);
