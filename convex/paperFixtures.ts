import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { assertOwner } from './office/access';
import { INSTRUMENTS } from './office/registry';
import { createTestRun, submit, settlePending } from './paper';
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
