import { v } from 'convex/values';
import {
  mutation,
  query,
  internalMutation,
  DatabaseReader,
  MutationCtx,
} from './_generated/server';
import { Id, Doc } from './_generated/dataModel';
import { internal } from './_generated/api';
import { assertOwner } from './office/access';
import { INSTRUMENTS } from './office/registry';
import { EMPLOYEES } from '../data/office';
import { proposalFields } from './trading/schema';
import {
  evaluate,
  initialAccount,
  fundingPostings,
  markAccount,
  reconcile,
  POLICY_VERSION,
  utcDay,
} from './trading/engine';
import { decimal } from './trading/math';
import type { Context, Proposal } from './trading/types';
import { initialBenchmark, advanceBenchmark } from './trading/benchmark';

export async function tradingContext(
  db: DatabaseReader,
  run: Doc<'paperRuns'>,
  now: number,
): Promise<Context> {
  const scope = run.mode === 'FIXTURE' ? String(run._id) : 'provider';
  const quotes: Context['quotes'] = {},
    capabilities: Context['capabilities'] = {};
  for (const instrument of INSTRUMENTS) {
    const q = await db
      .query('marketQuotes')
      .withIndex('scopeInstrument', (q) => q.eq('scope', scope).eq('instrumentId', instrument.id))
      .order('desc')
      .first();
    if (q) quotes[instrument.id] = q;
    const capability = await db
      .query('marketCapabilities')
      .withIndex('scopeInstrument', (q) => q.eq('scope', scope).eq('instrumentId', instrument.id))
      .unique();
    if (capability) capabilities[instrument.id] = capability;
  }
  const selected =
    run.mode === 'FIXTURE'
      ? INSTRUMENTS.map((i) => i.id)
      : (await db.query('officeInstruments').collect())
          .filter((i) => i.selected)
          .map((i) => i.instrumentId);
  return {
    now,
    quotes,
    capabilities,
    selected,
    mode: run.mode,
    globalPaused: run.status !== 'ACTIVE',
  };
}
export async function createTestRun(
  ctx: MutationCtx,
  mode: 'FIXTURE' | 'PROVIDER',
  label: string,
  clock: number,
) {
  const runId = await ctx.db.insert('paperRuns', {
    mode,
    label,
    clock,
    createdAt: Date.now(),
    status: 'ACTIVE',
    policyVersion: POLICY_VERSION,
  });
  await ctx.db.insert('paperBenchmarks', { runId, ...initialBenchmark(clock) });
  for (const employee of EMPLOYEES) {
    await ctx.db.insert('paperAccounts', { runId, agentId: employee.id, ...initialAccount(clock) });
    await ctx.db.insert('paperLedger', {
      runId,
      agentId: employee.id,
      event: 'TEST_FUNDING',
      at: clock,
      postings: fundingPostings(),
    });
  }
  return runId;
}
export const createRun = mutation({
  args: { ownerToken: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    if (!args.label.trim() || args.label.length > 100)
      throw new Error('Provide a short test label');
    return createTestRun(ctx, 'PROVIDER', args.label.trim(), Date.now());
  },
});

function requestKey(p: Proposal) {
  return JSON.stringify([
    p.agentId,
    p.cycleId,
    p.proposalIndex,
    p.instrumentId,
    p.action,
    p.quantity ?? null,
    p.amountFrom ?? null,
    p.fromCurrency ?? null,
    p.toCurrency ?? null,
  ]);
}
export async function submit(
  ctx: MutationCtx,
  runId: Id<'paperRuns'>,
  proposal: Proposal,
  now: number,
) {
  if (
    !proposal.cycleId ||
    proposal.cycleId.length > 100 ||
    !Number.isInteger(proposal.proposalIndex) ||
    proposal.proposalIndex < 0
  )
    throw new Error('Invalid idempotency key');
  const previous = await ctx.db
    .query('paperOrders')
    .withIndex('idempotency', (q) =>
      q
        .eq('runId', runId)
        .eq('agentId', proposal.agentId)
        .eq('cycleId', proposal.cycleId)
        .eq('proposalIndex', proposal.proposalIndex),
    )
    .unique();
  const requestHash = requestKey(proposal);
  if (previous) {
    if (previous.requestHash !== requestHash) throw new Error('IDEMPOTENCY_CONFLICT');
    return previous._id;
  }
  const run = await ctx.db.get(runId);
  if (!run) throw new Error('Unknown test run');
  const account = await ctx.db
    .query('paperAccounts')
    .withIndex('runAgent', (q) => q.eq('runId', runId).eq('agentId', proposal.agentId))
    .unique();
  if (!account) throw new Error('Unknown paper account');
  const context = await tradingContext(ctx.db, run, now);
  const postings = await ctx.db
    .query('paperLedger')
    .withIndex('runAgent', (q) => q.eq('runId', runId).eq('agentId', proposal.agentId))
    .collect();
  const balanced = reconcile(
    account,
    postings.flatMap((p) => p.postings),
  );
  if (!balanced) await ctx.db.patch(account._id, { paused: true });
  const pending = await ctx.db
    .query('paperOrders')
    .withIndex('pending', (q) => q.eq('runId', runId).eq('status', 'ACCEPTED'))
    .filter((q) => q.eq(q.field('agentId'), proposal.agentId))
    .collect();
  const capacity = account.filledToday + pending.length < 6;
  const decision = !balanced
    ? { accepted: false, reason: 'RECONCILIATION_FAILED' }
    : !capacity
      ? { accepted: false, reason: 'DAILY_TRADE_CAPACITY' }
      : evaluate(account, proposal, context);
  const orderId = await ctx.db.insert('paperOrders', {
    runId,
    ...proposal,
    acceptedAt: now,
    expiresAt: now + 180_000,
    ...(context.quotes[proposal.instrumentId]
      ? { observedQuoteId: context.quotes[proposal.instrumentId].quoteId }
      : {}),
    status: decision.accepted ? 'ACCEPTED' : 'REJECTED',
    reason: decision.reason,
    requestHash,
  });
  if (decision.accepted && run.mode === 'PROVIDER')
    await ctx.scheduler.runAfter(65_000, internal.marketData.poll, {
      instrumentId: proposal.instrumentId,
    });
  return orderId;
}
export const propose = mutation({
  args: { ownerToken: v.string(), runId: v.id('paperRuns'), proposal: v.object(proposalFields) },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    const run = await ctx.db.get(args.runId);
    if (run?.mode !== 'PROVIDER')
      throw new Error('Fixture scenarios cannot accept provider orders');
    return submit(ctx, args.runId, args.proposal, Date.now());
  },
});

export async function settlePending(
  ctx: MutationCtx,
  run: Doc<'paperRuns'>,
  now: number,
  instrumentId?: string,
) {
  const orders = await ctx.db
    .query('paperOrders')
    .withIndex('pending', (q) => q.eq('runId', run._id).eq('status', 'ACCEPTED'))
    .take(100);
  for (const order of orders) {
    if (order.expiresAt < now || run.status !== 'ACTIVE') {
      await ctx.db.patch(order._id, {
        status: 'REJECTED',
        reason: run.status !== 'ACTIVE' ? 'PAUSED' : 'ORDER_EXPIRED',
      });
      continue;
    }
    if (instrumentId && order.instrumentId !== instrumentId) continue;
    const context = await tradingContext(ctx.db, run, now),
      quote = context.quotes[order.instrumentId];
    if (
      !quote ||
      quote.quoteId === order.observedQuoteId ||
      quote.sourceTimestamp <= order.acceptedAt ||
      quote.retrievedAt <= order.acceptedAt
    )
      continue;
    const account = await ctx.db
      .query('paperAccounts')
      .withIndex('runAgent', (q) => q.eq('runId', run._id).eq('agentId', order.agentId))
      .unique();
    if (!account) throw new Error('Paper account missing');
    const history = await ctx.db
      .query('paperLedger')
      .withIndex('runAgent', (q) => q.eq('runId', run._id).eq('agentId', order.agentId))
      .collect();
    if (
      !reconcile(
        account,
        history.flatMap((e) => e.postings),
      )
    ) {
      await ctx.db.patch(account._id, { paused: true });
      await ctx.db.patch(order._id, { status: 'REJECTED', reason: 'RECONCILIATION_FAILED' });
      continue;
    }
    const result = evaluate(account, order, context, true);
    if (!result.accepted) {
      await ctx.db.patch(order._id, { status: 'REJECTED', reason: result.reason });
      continue;
    }
    await ctx.db.patch(account._id, result.account!);
    await ctx.db.insert('paperLedger', {
      runId: run._id,
      agentId: order.agentId,
      orderId: order._id,
      event: 'SIMULATED_FILL',
      at: now,
      postings: result.postings!,
    });
    await ctx.db.insert('paperFills', {
      runId: run._id,
      orderId: order._id,
      agentId: order.agentId,
      instrumentId: order.instrumentId,
      at: now,
      quoteId: result.quoteId!,
      price: result.price!,
      quantity: result.quantity!,
      gross: result.gross!,
      fee: result.fee!,
      feeCurrency: result.feeCurrency!,
      grossCurrency: result.grossCurrency!,
      spreadCost: result.spreadCost!,
      slippageCost: result.slippageCost!,
    });
    await ctx.db.patch(order._id, {
      status: 'FILLED',
      reason: 'FILLED',
      fillQuoteId: result.quoteId,
    });
  }
  const benchmark = await ctx.db
    .query('paperBenchmarks')
    .withIndex('run', (q) => q.eq('runId', run._id))
    .unique();
  if (benchmark && run.status === 'ACTIVE')
    await ctx.db.patch(
      benchmark._id,
      advanceBenchmark(benchmark, await tradingContext(ctx.db, run, now)),
    );
}
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query('paperRuns')
      .filter((q) => q.eq(q.field('mode'), 'PROVIDER'))
      .collect();
    for (const run of runs) await settlePending(ctx, run, Date.now());
  },
});
export const pauseAll = mutation({
  args: { ownerToken: v.string() },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    const runs = await ctx.db
      .query('paperRuns')
      .filter((q) =>
        q.and(q.eq(q.field('mode'), 'PROVIDER'), q.neq(q.field('status'), 'COMPLETED')),
      )
      .collect();
    for (const run of runs) {
      await ctx.db.patch(run._id, { status: 'PAUSED' });
      await settlePending(ctx, { ...run, status: 'PAUSED' }, Date.now());
    }
    await ctx.db.insert('officeAudit', {
      actor: 'owner',
      action: 'ALL_PAPER_TESTS_PAUSED',
      occurredAt: Date.now(),
    });
  },
});

export const setPaused = mutation({
  args: {
    ownerToken: v.string(),
    runId: v.id('paperRuns'),
    paused: v.boolean(),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    const run = await ctx.db.get(args.runId);
    if (!run || run.status === 'COMPLETED') throw new Error('Run unavailable');
    if (args.agentId) {
      const account = await ctx.db
        .query('paperAccounts')
        .withIndex('runAgent', (q) => q.eq('runId', args.runId).eq('agentId', args.agentId!))
        .unique();
      if (!account) throw new Error('Account unavailable');
      await ctx.db.patch(account._id, { paused: args.paused });
    } else {
      await ctx.db.patch(args.runId, { status: args.paused ? 'PAUSED' : 'ACTIVE' });
    }
    await ctx.db.insert('officeAudit', {
      actor: 'owner',
      action: args.paused ? 'PAPER_PAUSED' : 'PAPER_RESUMED',
      ...(args.agentId ? { employeeId: args.agentId } : {}),
      value: String(args.runId),
      occurredAt: Date.now(),
    });
    if (args.paused && args.agentId) {
      const pending = await ctx.db
        .query('paperOrders')
        .withIndex('pending', (q) => q.eq('runId', run._id).eq('status', 'ACCEPTED'))
        .filter((q) => q.eq(q.field('agentId'), args.agentId!))
        .collect();
      for (const order of pending)
        await ctx.db.patch(order._id, { status: 'REJECTED', reason: 'AGENT_PAUSED' });
    } else if (args.paused) await settlePending(ctx, { ...run, status: 'PAUSED' }, Date.now());
  },
});

// Fail closed at UTC rollover. New daily baselines need a timely, fully priced mark;
// no first-trade reset can conceal losses since the prior mark.
export const establishDay = internalMutation({
  args: { runId: v.id('paperRuns') },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.mode !== 'PROVIDER') throw new Error('Provider run required');
    const now = Date.now(),
      context = await tradingContext(ctx.db, run, now);
    for (const account of await ctx.db
      .query('paperAccounts')
      .withIndex('runAgent', (q) => q.eq('runId', run._id))
      .collect()) {
      const mark = markAccount(account, context);
      if (!mark.priced || !mark.equityUsd) continue;
      if (account.riskDay !== utcDay(now)) {
        const previous = await ctx.db
          .query('paperMarks')
          .withIndex('run', (q) => q.eq('runId', run._id))
          .order('desc')
          .filter((q) => q.eq(q.field('agentId'), account.agentId))
          .first();
        // Baseline must be witnessed within five minutes of midnight; otherwise manual incident review is required.
        const midnight = Date.parse(`${utcDay(now)}T00:00:00Z`);
        if (!previous?.equityUsd || Math.abs(previous.at - midnight) > 300_000) continue;
        await ctx.db.patch(account._id, {
          riskDay: utcDay(now),
          filledToday: 0,
          dailyBaselineUsd: decimal(previous.equityUsd).gt(mark.equityUsd)
            ? previous.equityUsd
            : mark.equityUsd,
        });
      }
      await ctx.db.insert('paperMarks', {
        runId: run._id,
        agentId: account.agentId,
        at: now,
        equityUsd: mark.equityUsd,
        priced: mark.priced,
        components: mark.components,
      });
    }
  },
});

export const dashboard = query({
  args: { clock: v.number() },
  handler: async (ctx) => {
    const runs = await ctx.db.query('paperRuns').order('desc').take(10);
    const summaries = [];
    for (const run of runs) {
      const context = await tradingContext(
        ctx.db,
        run,
        run.mode === 'FIXTURE' ? run.clock : Date.now(),
      );
      const accounts = await ctx.db
        .query('paperAccounts')
        .withIndex('runAgent', (q) => q.eq('runId', run._id))
        .collect();
      const portfolios = [];
      for (const account of accounts) {
        const ledger = await ctx.db
          .query('paperLedger')
          .withIndex('runAgent', (q) => q.eq('runId', run._id).eq('agentId', account.agentId))
          .collect();
        portfolios.push({
          ...account,
          mark: markAccount(account, context),
          reconciled: reconcile(
            account,
            ledger.flatMap((e) => e.postings),
          ),
        });
      }
      const benchmark = await ctx.db
        .query('paperBenchmarks')
        .withIndex('run', (q) => q.eq('runId', run._id))
        .unique();
      summaries.push({
        ...run,
        portfolios,
        benchmark: benchmark
          ? { ...benchmark, mark: markAccount(benchmark.account, context) }
          : null,
        orders: await ctx.db
          .query('paperOrders')
          .withIndex('pending', (q) => q.eq('runId', run._id))
          .order('desc')
          .take(30),
        fills: await ctx.db
          .query('paperFills')
          .withIndex('run', (q) => q.eq('runId', run._id))
          .collect(),
      });
    }
    return { runs: summaries };
  },
});
