import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { assertOwner } from './office/access';
import { EMPLOYEES, officeMap } from '../data/office';
import { INSTRUMENTS } from './office/registry';
import { marketState } from './office/calendar';
import { createEngine, startEngine, stopEngine } from './aiTown/main';
import { insertInput } from './aiTown/insertInput';
import { ENGINE_ACTION_DURATION } from './constants';

// Local deployment-admin operation; not callable from an unauthenticated browser.
// Preserves the original baseline world/history, creating an independent office.
export const bootstrap = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.OFFICE_PHASE !== '1')
      throw new Error('Phase 1 model-call lock must be configured');
    if (!process.env.OFFICE_OWNER_TOKEN || process.env.OFFICE_OWNER_TOKEN.length < 32)
      throw new Error('Configure OFFICE_OWNER_TOKEN before bootstrap');
    const existing = await ctx.db.query('officeSetup').first();
    if (existing) return existing.worldId;
    const old = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    if (old) {
      const engine = await ctx.db.get(old.engineId);
      if (engine?.running) await stopEngine(ctx, old.worldId);
      await ctx.db.patch(old._id, { isDefault: false, status: 'stoppedByDeveloper' });
    }
    const engineId = await createEngine(ctx);
    const worldId = await ctx.db.insert('worlds', {
      nextId: 0,
      players: [],
      agents: [],
      conversations: [],
    });
    await ctx.db.insert('worldStatus', {
      engineId,
      worldId,
      isDefault: true,
      lastViewed: Date.now(),
      status: 'running',
    });
    await ctx.db.insert('maps', { worldId, ...officeMap() });
    await ctx.db.insert('officeSetup', {
      worldId,
      phase: 'SETUP',
      layoutVersion: 1,
      paused: false,
      createdAt: Date.now(),
    });
    for (const [i, employee] of EMPLOYEES.entries())
      await ctx.db.insert('employeeProfiles', {
        worldId,
        employeeId: employee.id,
        playerId: `p:${i}`,
        name: employee.name,
        specialty: employee.specialty,
        strategy: employee.strategy,
        deskX: employee.desk.x,
        deskY: employee.desk.y,
        profileVersion: 1,
        modelCandidate: 'gpt-6-luna (unverified)',
        enabled: false,
      });
    for (const instrument of INSTRUMENTS)
      await ctx.db.insert('officeInstruments', {
        instrumentId: instrument.id,
        selected: true,
        entitlement: 'UNVERIFIED',
        updatedAt: Date.now(),
      });
    await insertInput(ctx, worldId, 'installOffice', {});
    await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
      worldId,
      generationNumber: 0,
      maxDuration: ENGINE_ACTION_DURATION,
    });
    await ctx.db.insert('officeAudit', {
      action: 'OFFICE_CREATED',
      actor: 'owner',
      occurredAt: Date.now(),
    });
    return worldId;
  },
});

export const overview = query({
  args: { clock: v.number() },
  handler: async (ctx) => {
    const setup = await ctx.db.query('officeSetup').first();
    if (!setup) return null;
    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', setup.worldId))
      .collect();
    const selections = await ctx.db.query('officeInstruments').collect();
    const now = Date.now();
    const coverage = await ctx.db
      .query('marketCapabilities')
      .filter((q) => q.eq(q.field('scope'), 'provider'))
      .collect();
    return {
      setup,
      profiles,
      asOf: now,
      instruments: INSTRUMENTS.map((instrument) => ({
        ...instrument,
        selected: selections.find((s) => s.instrumentId === instrument.id)?.selected ?? false,
        entitlement: coverage.some(
          (c) =>
            c.instrumentId === instrument.id &&
            c.quoteVerified &&
            c.candlesVerified &&
            c.rightsVerified &&
            c.sessionVerified &&
            c.sourceMode === 'live',
        )
          ? ('REVIEWED' as const)
          : ('UNVERIFIED' as const),
        session: marketState(instrument.calendarId, now),
      })),
      audit: await ctx.db.query('officeAudit').order('desc').take(15),
    };
  },
});

export const authenticate = mutation({
  args: { ownerToken: v.string() },
  handler: (_ctx, args) => {
    assertOwner(args.ownerToken);
    return true;
  },
});

export const setPaused = mutation({
  args: { ownerToken: v.string(), paused: v.boolean() },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    const office = await ctx.db.query('officeSetup').first();
    if (!office) throw new Error('Office not initialised');
    if (office.paused === args.paused) return;
    const status = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', office.worldId))
      .unique();
    if (!status) throw new Error('World not found');
    const engine = await ctx.db.get(status.engineId);
    if (!engine) throw new Error('Engine not found');
    if (args.paused && engine.running) await stopEngine(ctx, office.worldId);
    if (!args.paused && !engine.running) await startEngine(ctx, office.worldId);
    await ctx.db.patch(status._id, { status: args.paused ? 'stoppedByDeveloper' : 'running' });
    await ctx.db.patch(office._id, { paused: args.paused });
    await ctx.db.insert('officeAudit', {
      action: args.paused ? 'WORLD_PAUSED' : 'WORLD_RESUMED',
      actor: 'owner',
      occurredAt: Date.now(),
    });
  },
});

export const selectInstrument = mutation({
  args: { ownerToken: v.string(), instrumentId: v.string(), selected: v.boolean() },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    if (!INSTRUMENTS.some((i) => i.id === args.instrumentId)) throw new Error('Unknown instrument');
    const item = await ctx.db
      .query('officeInstruments')
      .withIndex('instrumentId', (q) => q.eq('instrumentId', args.instrumentId))
      .unique();
    if (!item) throw new Error('Registry not initialised');
    if (item.selected === args.selected) return;
    await ctx.db.patch(item._id, { selected: args.selected, updatedAt: Date.now() });
    await ctx.db.insert('officeAudit', {
      action: 'UNIVERSE_SELECTION',
      instrumentId: args.instrumentId,
      value: String(args.selected),
      actor: 'owner',
      occurredAt: Date.now(),
    });
  },
});

export const moveEmployee = mutation({
  args: { ownerToken: v.string(), employeeId: v.string(), x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    const office = await ctx.db.query('officeSetup').first();
    if (!office || office.paused) throw new Error('Office is paused or unavailable');
    const employee = await ctx.db
      .query('employeeProfiles')
      .withIndex('worldId', (q) => q.eq('worldId', office.worldId))
      .filter((q) => q.eq(q.field('employeeId'), args.employeeId))
      .unique();
    if (!employee) throw new Error('Unknown employee');
    const map = officeMap();
    if (
      !Number.isInteger(args.x) ||
      !Number.isInteger(args.y) ||
      args.x < 0 ||
      args.y < 0 ||
      args.x >= map.width ||
      args.y >= map.height ||
      map.objectTiles.some((layer) => layer[args.x][args.y] !== -1)
    )
      throw new Error('Choose an empty floor tile');
    const inputId = await insertInput(ctx, office.worldId, 'moveTo', {
      playerId: employee.playerId,
      destination: { x: args.x, y: args.y },
    });
    await ctx.db.insert('officeAudit', {
      action: 'AVATAR_MOVED',
      employeeId: args.employeeId,
      value: `${args.x},${args.y}`,
      actor: 'owner',
      occurredAt: Date.now(),
    });
    return inputId;
  },
});
