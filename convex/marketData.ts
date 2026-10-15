import { v } from 'convex/values';
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
  QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { assertOwner } from './office/access';
import { INSTRUMENTS } from './office/registry';
import {
  KrakenProvider,
  TwelveProvider,
  ProviderClockError,
  validateCandles,
} from './trading/providers';
import type { Quote } from './trading/types';
import { validQuote, utcDay } from './trading/engine';
import { quoteFields, candleFields } from './trading/schema';
import { settlePending } from './paper';

export const reserve = internalMutation({
  args: { provider: v.string(), cost: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now(),
      day = utcDay(now),
      minute = Math.floor(now / 60_000);
    const record = await ctx.db
      .query('providerQuota')
      .withIndex('provider', (q) => q.eq('provider', args.provider))
      .unique();
    const dailyUsed = record?.day === day ? record.dailyUsed : 0,
      minuteUsed = record?.minute === minute ? record.minuteUsed : 0;
    const maxMinute = args.provider === 'twelve' ? 8 : 30,
      maxDay = args.provider === 'twelve' ? 800 : 10000;
    if (
      (record?.blockedUntil ?? 0) > now ||
      minuteUsed + args.cost > maxMinute ||
      dailyUsed + args.cost > maxDay
    )
      return false;
    const value = {
      provider: args.provider,
      day,
      minute,
      dailyUsed: dailyUsed + args.cost,
      minuteUsed: minuteUsed + args.cost,
      blockedUntil: record?.blockedUntil ?? 0,
    };
    if (record) await ctx.db.patch(record._id, value);
    else await ctx.db.insert('providerQuota', value);
    return true;
  },
});
export const failure = internalMutation({
  args: {
    instrumentId: v.string(),
    provider: v.string(),
    message: v.string(),
    diagnostic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('feedEvents', { ...args, at: Date.now(), status: 'ERROR' });
    const capability = await ctx.db
      .query('marketCapabilities')
      .withIndex('scopeInstrument', (q) =>
        q.eq('scope', 'provider').eq('instrumentId', args.instrumentId),
      )
      .unique();
    if (capability) await ctx.db.patch(capability._id, { quoteVerified: false });
    const quota = await ctx.db
      .query('providerQuota')
      .withIndex('provider', (q) => q.eq('provider', args.provider))
      .unique();
    if (quota) await ctx.db.patch(quota._id, { blockedUntil: Date.now() + 60_000 });
  },
});
export const ingest = internalMutation({
  args: { quote: v.object(quoteFields), candles: v.array(v.object(candleFields)) },
  handler: async (ctx, args) => {
    const now = Date.now();
    validQuote(args.quote, now);
    validateCandles(args.candles, now);
    const instrument = INSTRUMENTS.find((i) => i.id === args.quote.instrumentId);
    if (!instrument) throw new Error('UNKNOWN_INSTRUMENT');
    if (
      args.quote.sourceMode === 'fixture' ||
      args.candles.some(
        (c) => c.instrumentId !== instrument.id || c.provider !== args.quote.provider,
      )
    )
      throw new Error('PROVIDER_SCOPE_MISMATCH');
    const previous = await ctx.db
      .query('marketCapabilities')
      .withIndex('scopeInstrument', (q) =>
        q.eq('scope', 'provider').eq('instrumentId', instrument.id),
      )
      .unique();
    const quote = { ...args.quote, sourceMode: previous?.sourceMode ?? args.quote.sourceMode };
    const latest = await ctx.db
      .query('marketQuotes')
      .withIndex('scopeInstrument', (q) =>
        q.eq('scope', 'provider').eq('instrumentId', instrument.id),
      )
      .order('desc')
      .first();
    if (
      !latest ||
      quote.sourceTimestamp > latest.sourceTimestamp ||
      (quote.sourceTimestamp === latest.sourceTimestamp && quote.quoteId !== latest.quoteId)
    )
      await ctx.db.insert('marketQuotes', { ...quote, scope: 'provider' });
    for (const candle of args.candles) {
      const exists = await ctx.db
        .query('marketCandles')
        .withIndex('scopeInstrument', (q) =>
          q.eq('scope', 'provider').eq('instrumentId', instrument.id),
        )
        .filter((q) => q.eq(q.field('start'), candle.start))
        .first();
      if (!exists) await ctx.db.insert('marketCandles', { ...candle, scope: 'provider' });
    }
    const capability = {
      instrumentId: instrument.id,
      provider: quote.provider,
      quoteVerified: true,
      candlesVerified: args.candles.length > 0,
      rightsVerified: previous?.rightsVerified ?? false,
      sessionVerified: previous?.sessionVerified ?? instrument.assetClass === 'crypto',
      corporateActionsClearUntil: previous?.corporateActionsClearUntil ?? 0,
      sourceMode: quote.sourceMode,
      scope: 'provider',
      verifiedAt: now,
    };
    if (previous) await ctx.db.patch(previous._id, capability);
    else await ctx.db.insert('marketCapabilities', capability);
    await ctx.db.insert('feedEvents', {
      instrumentId: instrument.id,
      provider: quote.provider,
      at: now,
      status: 'RECEIVED',
      message: `Source ${new Date(quote.sourceTimestamp).toISOString()}; ${args.candles.length} closed raw candles`,
    });
    for (const run of await ctx.db
      .query('paperRuns')
      .filter((q) => q.eq(q.field('mode'), 'PROVIDER'))
      .collect())
      await settlePending(ctx, run, now, instrument.id);
  },
});
export const poll = internalAction({
  args: { instrumentId: v.string() },
  handler: async (ctx, args): Promise<{ status: string }> => {
    const instrument = INSTRUMENTS.find((i) => i.id === args.instrumentId);
    if (!instrument) throw new Error('Unknown instrument');
    const name = instrument.assetClass === 'crypto' ? 'kraken' : 'twelve';
    if (name === 'twelve' && !process.env.TWELVE_DATA_API_KEY) {
      await ctx.runMutation(internal.marketData.failure, {
        instrumentId: instrument.id,
        provider: name,
        message: 'CREDENTIAL_REQUIRED',
      });
      return { status: 'CREDENTIAL_REQUIRED' };
    }
    if (
      !(await ctx.runMutation(internal.marketData.reserve, {
        provider: name,
        cost: name === 'kraken' ? 4 : 2,
      }))
    )
      return { status: 'QUOTA_OR_COOLDOWN' };
    let stage = 'health';
    let quote: Quote | undefined;
    try {
      const provider =
        name === 'kraken'
          ? new KrakenProvider()
          : new TwelveProvider(process.env.TWELVE_DATA_API_KEY!);
      if (!(await provider.health())) throw new Error('PROVIDER_UNHEALTHY');
      stage = 'quote';
      quote = await provider.getQuote(instrument);
      // Validate here as well as transactionally, preserving specific errors and
      // avoiding a candle request when the source clock already fails validation.
      validQuote(quote, Date.now());
      stage = 'candles';
      const candles = await provider.getClosedCandles(instrument, Date.now());
      validateCandles(candles, Date.now());
      stage = 'ingest';
      await ctx.runMutation(internal.marketData.ingest, { quote, candles });
      return { status: 'RECEIVED' };
    } catch (error) {
      const message =
        error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
          ? error.message
          : 'PROVIDER_INVALID_RESPONSE';
      // Construct diagnostics exclusively from trusted stage names and numeric
      // clocks. Never retain arbitrary upstream error text or credential URLs.
      const diagnostic =
        error instanceof ProviderClockError
          ? `stage=${stage}; providerMs=${error.providerTimestamp}; checkedMs=${error.checkedAt}; skewMs=${error.providerTimestamp - error.checkedAt}`
          : quote
            ? `stage=${stage}; sourceMs=${quote.sourceTimestamp}; retrievedMs=${quote.retrievedAt}; checkedMs=${Date.now()}`
            : `stage=${stage}`;
      await ctx.runMutation(internal.marketData.failure, {
        instrumentId: instrument.id,
        provider: name,
        message,
        diagnostic,
      });
      return { status: message };
    }
  },
});
export const refresh = action({
  args: { ownerToken: v.string(), instrumentId: v.string() },
  handler: async (ctx, args): Promise<{ status: string }> => {
    assertOwner(args.ownerToken);
    return ctx.runAction(internal.marketData.poll, { instrumentId: args.instrumentId });
  },
});
export const review = mutation({
  args: {
    ownerToken: v.string(),
    instrumentId: v.string(),
    reference: v.string(),
    rightsVerified: v.boolean(),
    sessionVerified: v.boolean(),
    sourceMode: v.union(v.literal('live'), v.literal('delayed'), v.literal('indicative')),
    corporateActionsClearUntil: v.number(),
  },
  handler: async (ctx, args) => {
    assertOwner(args.ownerToken);
    if (args.reference.trim().length < 12 || args.reference.length > 1000)
      throw new Error('A dated provider/session/rights review reference is required');
    if (
      !Number.isFinite(args.corporateActionsClearUntil) ||
      args.corporateActionsClearUntil > Date.now() + 7 * 86400_000
    )
      throw new Error('Corporate action review must cover at most seven days');
    const capability = await ctx.db
      .query('marketCapabilities')
      .withIndex('scopeInstrument', (q) =>
        q.eq('scope', 'provider').eq('instrumentId', args.instrumentId),
      )
      .unique();
    if (!capability?.quoteVerified || !capability.candlesVerified)
      throw new Error('Fetch actual quote and candle evidence first');
    await ctx.db.patch(capability._id, {
      rightsVerified: args.rightsVerified,
      sessionVerified: args.sessionVerified,
      sourceMode: args.sourceMode,
      corporateActionsClearUntil: args.corporateActionsClearUntil,
      reviewReference: args.reference,
      verifiedAt: Date.now(),
    });
    await ctx.db.insert('officeAudit', {
      actor: 'owner',
      action: 'FEED_REVIEW',
      instrumentId: args.instrumentId,
      value: args.reference,
      occurredAt: Date.now(),
    });
  },
});
export const status = query({
  args: { clock: v.number() },
  handler: (ctx) => readFeedStatus(ctx),
});

// The terminal receives timing/status metadata without price fields by default.
// The existing server-side feed cache and paper broker remain independent.
export const terminal = query({
  args: { clock: v.number() },
  handler: async (ctx) => {
    const setup = await ctx.db.query('officeSetup').first();
    const pricesEnabled = setup?.terminalPricesEnabled ?? false;
    const data = await readFeedStatus(ctx);
    return {
      pricesEnabled,
      rows: data.rows.map((row) => ({
        instrumentId: row.instrumentId,
        symbol: row.symbol,
        provider: row.provider,
        configured: row.configured,
        event: row.event,
        quote: row.quote
          ? {
              sourceTimestamp: row.quote.sourceTimestamp,
              currency: row.quote.currency,
              sourceMode: row.quote.sourceMode,
              ...(pricesEnabled ? { last: row.quote.last } : {}),
            }
          : null,
      })),
    };
  },
});

async function readFeedStatus(ctx: QueryCtx) {
  const rows = [];
  for (const instrument of INSTRUMENTS) {
    const quote = await ctx.db
      .query('marketQuotes')
      .withIndex('scopeInstrument', (q) =>
        q.eq('scope', 'provider').eq('instrumentId', instrument.id),
      )
      .order('desc')
      .first();
    const capability = await ctx.db
      .query('marketCapabilities')
      .withIndex('scopeInstrument', (q) =>
        q.eq('scope', 'provider').eq('instrumentId', instrument.id),
      )
      .unique();
    const event = await ctx.db
      .query('feedEvents')
      .withIndex('instrument', (q) => q.eq('instrumentId', instrument.id))
      .order('desc')
      .first();
    rows.push({
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      provider: instrument.assetClass === 'crypto' ? 'kraken' : 'twelve',
      configured: instrument.assetClass === 'crypto' || !!process.env.TWELVE_DATA_API_KEY,
      quote,
      capability,
      event,
    });
  }
  return { rows, quota: await ctx.db.query('providerQuota').collect() };
}

// Durable shared polling: independent of visual-world heartbeat; enabled only by active provider TEST runs.
export const due = internalMutation({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query('paperRuns')
      .filter((q) => q.and(q.eq(q.field('mode'), 'PROVIDER'), q.eq(q.field('status'), 'ACTIVE')))
      .collect();
    if (!runs.length) return;
    const selected = await ctx.db
      .query('officeInstruments')
      .filter((q) => q.eq(q.field('selected'), true))
      .collect();
    for (const [index, item] of selected.entries()) {
      const latest = await ctx.db
        .query('feedEvents')
        .withIndex('instrument', (q) => q.eq('instrumentId', item.instrumentId))
        .order('desc')
        .first();
      if (!latest || Date.now() - latest.at >= 3600_000) {
        await ctx.db.insert('feedEvents', {
          instrumentId: item.instrumentId,
          provider: item.instrumentId.startsWith('kraken:') ? 'kraken' : 'twelve',
          at: Date.now(),
          status: 'SCHEDULED',
          message: 'Hourly shared polling reserved',
        });
        await ctx.scheduler.runAfter(index * 16_000, internal.marketData.poll, {
          instrumentId: item.instrumentId,
        });
      }
    }
    for (const run of runs)
      await ctx.scheduler.runAfter(0, internal.paper.establishDay, { runId: run._id });
  },
});
