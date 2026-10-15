import { v } from 'convex/values';
import { mutation, internalMutation, query, MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { assertOwner } from './office/access';
import { INSTRUMENTS } from './office/registry';
import { createTestRun, submit, settlePending, reconcileRun } from './paper';
import { reconcile } from './trading/engine';
import type { Proposal } from './trading/types';

// Explicitly synthetic test prices. These never enter provider scope or an official experiment.
export const runScenario = mutation({
  args: { ownerToken: v.string() },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    const clock = Date.parse('2026-10-15T14:00:00Z');
    const runId = await createTestRun(
      ctx,
      'FIXTURE',
      'SCRIPTED FIXTURE — NOT MARKET RESULTS',
      clock,
    );
    const prices: Record<string, string> = {
      'EUR/USD': '1.10',
      'GBP/USD': '1.25',
      'USD/JPY': '150',
      'BTC/USD': '50000',
      'ETH/USD': '2000',
      'SOL/USD': '100',
    };
    for (const instrument of INSTRUMENTS) {
      const last = prices[instrument.symbol] ?? '100';
      await ctx.db.insert('marketCapabilities', {
        scope: String(runId),
        instrumentId: instrument.id,
        provider: 'fixture',
        quoteVerified: true,
        candlesVerified: true,
        rightsVerified: true,
        sessionVerified: true,
        corporateActionsClearUntil: clock + 86400_000,
        sourceMode: 'fixture',
        verifiedAt: Date.now(),
      });
      await ctx.db.insert('marketQuotes', {
        scope: String(runId),
        quoteId: `fixture:${instrument.id}:before`,
        instrumentId: instrument.id,
        provider: 'fixture',
        venue: instrument.venue,
        currency: instrument.quoteCurrency,
        last,
        sourceTimestamp: clock - 1000,
        retrievedAt: clock - 500,
        sourceMode: 'fixture',
        delayMs: 0,
        healthy: true,
      });
      await ctx.db.insert('marketCandles', {
        scope: String(runId),
        instrumentId: instrument.id,
        provider: 'fixture',
        start: clock - 3600_000,
        end: clock,
        open: last,
        high: last,
        low: last,
        close: last,
        adjustment: 'raw',
      });
    }
    const proposals: Proposal[] = [
      {
        agentId: 'alex',
        cycleId: 'fixture-cycle',
        proposalIndex: 0,
        instrumentId: 'us:AAPL',
        action: 'BUY',
        quantity: '1',
      },
      {
        agentId: 'sophie',
        cycleId: 'fixture-cycle',
        proposalIndex: 0,
        instrumentId: 'fx:EUR/USD',
        action: 'CONVERT_CURRENCY',
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        amountFrom: '100',
      },
      {
        agentId: 'marcus',
        cycleId: 'fixture-cycle',
        proposalIndex: 0,
        instrumentId: 'kraken:BTC/USD',
        action: 'BUY',
        quantity: '0.002',
      },
      {
        agentId: 'nina',
        cycleId: 'fixture-cycle',
        proposalIndex: 0,
        instrumentId: 'us:GLD',
        action: 'BUY',
        quantity: '1',
      },
      {
        agentId: 'oliver',
        cycleId: 'fixture-cycle',
        proposalIndex: 0,
        instrumentId: 'us:SPY',
        action: 'BUY',
        quantity: '1',
      },
    ];
    for (const proposal of proposals) {
      const id = await submit(ctx, runId, proposal, clock);
      const retried = await submit(ctx, runId, proposal, clock);
      if (id !== retried) throw new Error('Fixture idempotency failed');
    }
    const run = (await ctx.db.get(runId))!;
    await settlePending(ctx, run, clock);
    if (
      (
        await ctx.db
          .query('paperFills')
          .withIndex('run', (q) => q.eq('runId', runId))
          .collect()
      ).length !== 0
    )
      throw new Error('Look-ahead: filled on observed quote');
    for (const instrument of INSTRUMENTS)
      await ctx.db.insert('marketQuotes', {
        scope: String(runId),
        quoteId: `fixture:${instrument.id}:after`,
        instrumentId: instrument.id,
        provider: 'fixture',
        venue: instrument.venue,
        currency: instrument.quoteCurrency,
        last: prices[instrument.symbol] ?? '100',
        sourceTimestamp: clock + 1000,
        retrievedAt: clock + 1500,
        sourceMode: 'fixture',
        delayMs: 0,
        healthy: true,
      });
    await settlePending(ctx, run, clock + 2000);
    await settlePending(ctx, run, clock + 2000);
    const fills = await ctx.db
      .query('paperFills')
      .withIndex('run', (q) => q.eq('runId', runId))
      .collect();
    if (fills.length !== 5) throw new Error('Expected five next-quote fixture fills');
    for (const account of await ctx.db
      .query('paperAccounts')
      .withIndex('runAgent', (q) => q.eq('runId', runId))
      .collect()) {
      const events = await ctx.db
        .query('paperLedger')
        .withIndex('runAgent', (q) => q.eq('runId', runId).eq('agentId', account.agentId))
        .collect();
      if (
        !reconcile(
          account,
          events.flatMap((e) => e.postings),
        )
      )
        throw new Error('Fixture reconciliation failed');
    }
    await ctx.db.patch(runId, { clock: clock + 2000, status: 'COMPLETED' });
    await ctx.db.insert('officeAudit', {
      actor: 'owner',
      action: 'SCRIPTED_FIXTURE_COMPLETED',
      value: String(runId),
      occurredAt: Date.now(),
    });
    return { runId, fills: fills.length, source: 'FIXTURE', reconciled: true };
  },
});

// Fault injection is confined to a new FIXTURE scope. This never mutates a
// provider account, its permissions, or its quote history.
export const runRecoveryScenario = mutation({
  args: { ownerToken: v.string() },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    return recoveryScenario(ctx, 'RECOVERY FIXTURE — intentional isolated corruption');
  },
});

async function recoveryScenario(ctx: MutationCtx, label: string) {
  const clock = Date.parse('2026-10-15T14:00:00Z');
  const runId = await createTestRun(ctx, 'FIXTURE', label, clock);
  const run = (await ctx.db.get(runId))!;
  const instrumentId = 'kraken:BTC/USD';
  await ctx.db.insert('marketCapabilities', {
    scope: String(runId),
    instrumentId,
    provider: 'fixture',
    quoteVerified: true,
    candlesVerified: true,
    rightsVerified: true,
    sessionVerified: true,
    corporateActionsClearUntil: clock + 86400_000,
    sourceMode: 'fixture',
    verifiedAt: Date.now(),
  });
  const quote = {
    scope: String(runId),
    instrumentId,
    provider: 'fixture',
    venue: 'KRAKEN',
    currency: 'USD',
    last: '50000',
    sourceMode: 'fixture' as const,
    delayMs: 0,
    healthy: true,
  };
  await ctx.db.insert('marketQuotes', {
    ...quote,
    quoteId: 'recovery:before',
    sourceTimestamp: clock - 1000,
    retrievedAt: clock - 500,
  });
  const proposal: Proposal = {
    agentId: 'alex',
    cycleId: 'recovery',
    proposalIndex: 0,
    instrumentId,
    action: 'BUY',
    quantity: '0.0003',
  };
  const expiredId = await submit(ctx, runId, proposal, clock);
  if ((await ctx.db.get(expiredId))?.status !== 'ACCEPTED')
    throw new Error('Recovery setup rejected');
  await settlePending(ctx, run, clock + 180_000);
  if ((await ctx.db.get(expiredId))?.reason !== 'ORDER_EXPIRED')
    throw new Error('Expiry boundary failed');
  if ((await submit(ctx, runId, proposal, clock + 180_000)) !== expiredId)
    throw new Error('Expired retry duplicated');
  await ctx.db.insert('marketQuotes', {
    ...quote,
    quoteId: 'recovery:fresh',
    sourceTimestamp: clock + 180_001,
    retrievedAt: clock + 180_002,
  });
  const pendingId = await submit(ctx, runId, { ...proposal, proposalIndex: 1 }, clock + 180_003);
  if ((await ctx.db.get(pendingId))?.status !== 'ACCEPTED')
    throw new Error('Recovery pending setup rejected');
  const account = (await ctx.db
    .query('paperAccounts')
    .withIndex('runAgent', (q) => q.eq('runId', runId).eq('agentId', 'alex'))
    .unique())!;
  // Deliberate one-cent discrepancy to exercise the production reconciliation path.
  await ctx.db.patch(account._id, { cash: { ...account.cash, USD: '1000.01' } });
  await reconcileRun(ctx, run, clock + 180_004);
  await reconcileRun(ctx, run, clock + 180_005);
  if (!(await ctx.db.get(account._id))?.paused) throw new Error('Mismatch did not pause account');
  if ((await ctx.db.get(pendingId))?.reason !== 'RECONCILIATION_FAILED')
    throw new Error('Mismatch did not reject pending order');
  const incidents = await ctx.db
    .query('paperIncidents')
    .withIndex('run', (q) => q.eq('runId', runId))
    .collect();
  if (incidents.length !== 1) throw new Error('Incident retry duplicated');
  await settlePending(ctx, run, clock + 180_006);
  const fills = await ctx.db
    .query('paperFills')
    .withIndex('run', (q) => q.eq('runId', runId))
    .collect();
  const ledger = await ctx.db
    .query('paperLedger')
    .withIndex('runAgent', (q) => q.eq('runId', runId))
    .collect();
  if (fills.length || ledger.some((e) => e.event !== 'TEST_FUNDING'))
    throw new Error('Recovery posted a forbidden fill');
  // A bounded TEST must reject at its deadline even before the expiry cron runs.
  await ctx.db.patch(runId, { stopAt: clock + 180_007 });
  const deadlineId = await submit(
    ctx,
    runId,
    { ...proposal, agentId: 'sophie', proposalIndex: 2 },
    clock + 180_007,
  );
  if ((await ctx.db.get(deadlineId))?.reason !== 'PAUSED')
    throw new Error('Bounded TEST accepted an order at its deadline');
  await ctx.db.patch(runId, { clock: clock + 180_008, status: 'COMPLETED' });
  await ctx.db.insert('officeAudit', {
    actor: 'owner',
    action: 'RECOVERY_FIXTURE_COMPLETED',
    value: String(runId),
    occurredAt: Date.now(),
  });
  return {
    runId,
    source: 'FIXTURE',
    expiryPassed: true,
    discrepancyDetected: true,
    deadlinePassed: true,
    incidents: incidents.length,
    fills: fills.length,
  };
}

export const scheduledRecovery = internalMutation({
  args: { checkId: v.string() },
  handler: (ctx, args) => recoveryScenario(ctx, `RECOVERY FIXTURE ${args.checkId}`),
});

export const scheduleRecovery = mutation({
  args: { ownerToken: v.string(), checkId: v.string(), delayMs: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Id<'_scheduled_functions'>> => {
    assertOwner(args.ownerToken);
    if (!/^[a-zA-Z0-9-]{1,40}$/.test(args.checkId)) throw new Error('Invalid check ID');
    const delayMs = args.delayMs ?? 5000;
    if (!Number.isInteger(delayMs) || delayMs < 5000 || delayMs > 120000)
      throw new Error('Recovery delay must be 5–120 seconds');
    const jobId = await ctx.scheduler.runAfter(delayMs, internal.paperFixtures.scheduledRecovery, {
      checkId: args.checkId,
    });
    await ctx.db.insert('officeAudit', {
      actor: 'owner',
      action: 'RECOVERY_FIXTURE_SCHEDULED',
      value: String(jobId),
      occurredAt: Date.now(),
    });
    return jobId;
  },
});

export const recoveryJobStatus = query({
  args: { ownerToken: v.string(), jobId: v.id('_scheduled_functions') },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    const job = await ctx.db.system.get(args.jobId);
    if (!job) throw new Error('Recovery job unavailable');
    return { state: job.state.kind, name: job.name, scheduledTime: job.scheduledTime };
  },
});
