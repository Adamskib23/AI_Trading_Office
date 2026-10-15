// Controlled baseline checks only. This never creates AI agents or calls a model.
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const client = new ConvexHttpClient('http://127.0.0.1:3210');
const mode = process.argv[2];
if (mode === 'init') {
  await client.mutation(api.init.default, { numAgents: 0 });
  console.log('Initialised upstream map with zero AI agents.');
} else if (mode === 'status') {
  const status = await client.query(api.world.defaultWorldStatus, {});
  if (!status) throw new Error('No default world');
  const { world, engine } = await client.query(api.world.worldState, { worldId: status.worldId });
  console.log(JSON.stringify({ status: status.status, players: world.players.length,
    agents: world.agents.length, engineRunning: engine.running, engineTime: engine.currentTime }));
} else if (mode === 'move') {
  const status = await client.query(api.world.defaultWorldStatus, {});
  if (!status) throw new Error('No default world');
  const { world } = await client.query(api.world.worldState, { worldId: status.worldId });
  if (world.agents.length) throw new Error('This check requires a zero-agent baseline');
  const inputId = await client.mutation(api.world.joinWorld, { worldId: status.worldId });
  const deadline = Date.now() + 10000;
  let joined;
  while (Date.now() < deadline) {
    joined = await client.query(api.aiTown.main.inputStatus, { inputId });
    if (joined) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (joined?.kind !== 'ok') throw new Error(`Join failed: ${JSON.stringify(joined)}`);
  const state = await client.query(api.world.worldState, { worldId: status.worldId });
  const player = state.world.players.find(p => p.human === 'Me');
  if (!player) throw new Error('Human player missing');
  const descriptions = await client.query(api.world.gameDescriptions, { worldId: status.worldId });
  const map = descriptions.worldMap;
  // Pick a directly adjacent empty map tile; engine remains the movement authority.
  const destination = [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy]) => ({x:player.position.x+dx,y:player.position.y+dy}))
    .find(({x,y}) => x>=0 && y>=0 && x<map.width && y<map.height &&
      map.objectTiles.every(layer => layer[y][x] === -1));
  if (!destination) throw new Error('No empty adjacent tile; rerun after leaving world');
  const moveId = await client.mutation(api.aiTown.main.sendInput, {
    worldId:status.worldId, name:'moveTo', args:{playerId:player.id,destination}
  });
  await new Promise(resolve => setTimeout(resolve, 2500));
  const result = await client.query(api.aiTown.main.inputStatus, { inputId:moveId });
  const after = await client.query(api.world.worldState, {worldId:status.worldId});
  const moved = after.world.players.find(p => p.id === player.id);
  console.log(JSON.stringify({join:joined.kind,move:result,before:player.position,
    target:destination,after:moved?.position,agents:after.world.agents.length}));
  if (result?.kind !== 'ok' || !moved ||
      moved.position.x!==destination.x || moved.position.y!==destination.y)
    throw new Error('Movement did not reach target');
} else {
  throw new Error('Usage: node scripts/phase0-smoke.mjs init|status|move');
}
