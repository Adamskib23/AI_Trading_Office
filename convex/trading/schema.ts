import { defineTable } from 'convex/server';
import { v } from 'convex/values';
export const accountFields = {
  cash: v.object({ USD: v.string(), EUR: v.string(), GBP: v.string(), JPY: v.string() }),
  positions: v.record(v.string(), v.string()),
  initialUsd: v.string(),
  dailyBaselineUsd: v.string(),
  riskDay: v.string(),
  filledToday: v.number(),
  paused: v.boolean(),
};
export const proposalFields = {
  agentId: v.string(),
  cycleId: v.string(),
  proposalIndex: v.number(),
  instrumentId: v.string(),
  action: v.union(v.literal('BUY'), v.literal('SELL'), v.literal('CONVERT_CURRENCY')),
  quantity: v.optional(v.string()),
  amountFrom: v.optional(v.string()),
  fromCurrency: v.optional(
    v.union(v.literal('USD'), v.literal('EUR'), v.literal('GBP'), v.literal('JPY')),
  ),
  toCurrency: v.optional(
    v.union(v.literal('USD'), v.literal('EUR'), v.literal('GBP'), v.literal('JPY')),
  ),
};
export const quoteFields = {
  quoteId: v.string(),
  instrumentId: v.string(),
  provider: v.string(),
  venue: v.string(),
  currency: v.string(),
  sourceTimestamp: v.number(),
  retrievedAt: v.number(),
  last: v.string(),
  bid: v.optional(v.string()),
  ask: v.optional(v.string()),
  sourceMode: v.union(
    v.literal('live'),
    v.literal('delayed'),
    v.literal('indicative'),
    v.literal('fixture'),
  ),
  delayMs: v.number(),
  healthy: v.boolean(),
};
export const candleFields = {
  instrumentId: v.string(),
  provider: v.string(),
  start: v.number(),
  end: v.number(),
  open: v.string(),
  high: v.string(),
  low: v.string(),
  close: v.string(),
  volume: v.optional(v.string()),
  adjustment: v.literal('raw'),
};
export const capabilityFields = {
  instrumentId: v.string(),
  provider: v.string(),
  quoteVerified: v.boolean(),
  candlesVerified: v.boolean(),
  rightsVerified: v.boolean(),
  sessionVerified: v.boolean(),
  corporateActionsClearUntil: v.number(),
  sourceMode: v.union(
    v.literal('live'),
    v.literal('delayed'),
    v.literal('indicative'),
    v.literal('fixture'),
  ),
};
export const postingFields = {
  asset: v.string(),
  account: v.union(
    v.literal('agent'),
    v.literal('clearing'),
    v.literal('fees'),
    v.literal('funding'),
  ),
  delta: v.string(),
};
export const tradingTables = {
  paperIncidents: defineTable({
    runId: v.id('paperRuns'),
    agentId: v.string(),
    code: v.string(),
    at: v.number(),
  }).index('run', ['runId']),
  paperBenchmarks: defineTable({
    runId: v.id('paperRuns'),
    startedAt: v.number(),
    account: v.object(accountFields),
    legs: v.array(
      v.object({
        instrumentId: v.string(),
        filledAt: v.optional(v.number()),
        quoteId: v.optional(v.string()),
        quantity: v.optional(v.string()),
        fee: v.optional(v.string()),
        price: v.optional(v.string()),
        sourceTimestamp: v.optional(v.number()),
        retrievedAt: v.optional(v.number()),
        provider: v.optional(v.string()),
      }),
    ),
  }).index('run', ['runId']),
  paperRuns: defineTable({
    mode: v.union(v.literal('FIXTURE'), v.literal('PROVIDER')),
    createdAt: v.number(),
    clock: v.number(),
    status: v.union(v.literal('ACTIVE'), v.literal('PAUSED'), v.literal('COMPLETED')),
    policyVersion: v.string(),
    label: v.string(),
    stopAt: v.optional(v.number()),
    dayCheckAt: v.optional(v.number()),
  }),
  paperChecks: defineTable({
    runId: v.id('paperRuns'),
    kind: v.string(),
    at: v.number(),
    passed: v.boolean(),
    details: v.string(),
  }).index('run', ['runId']),
  paperAccounts: defineTable({
    runId: v.id('paperRuns'),
    agentId: v.string(),
    ...accountFields,
  }).index('runAgent', ['runId', 'agentId']),
  paperOrders: defineTable({
    runId: v.id('paperRuns'),
    ...proposalFields,
    acceptedAt: v.number(),
    expiresAt: v.number(),
    observedQuoteId: v.optional(v.string()),
    status: v.union(v.literal('ACCEPTED'), v.literal('FILLED'), v.literal('REJECTED')),
    reason: v.string(),
    requestHash: v.string(),
    fillQuoteId: v.optional(v.string()),
  })
    .index('idempotency', ['runId', 'agentId', 'cycleId', 'proposalIndex'])
    .index('pending', ['runId', 'status']),
  paperFills: defineTable({
    runId: v.id('paperRuns'),
    orderId: v.id('paperOrders'),
    agentId: v.string(),
    instrumentId: v.string(),
    at: v.number(),
    quoteId: v.string(),
    sourceTimestamp: v.optional(v.number()),
    retrievedAt: v.optional(v.number()),
    provider: v.optional(v.string()),
    sourceMode: v.optional(
      v.union(
        v.literal('live'),
        v.literal('delayed'),
        v.literal('indicative'),
        v.literal('fixture'),
      ),
    ),
    price: v.string(),
    quantity: v.string(),
    gross: v.string(),
    fee: v.string(),
    spreadCost: v.string(),
    slippageCost: v.string(),
    feeCurrency: v.string(),
    grossCurrency: v.string(),
  }).index('run', ['runId']),
  paperLedger: defineTable({
    runId: v.id('paperRuns'),
    agentId: v.string(),
    orderId: v.optional(v.id('paperOrders')),
    event: v.string(),
    at: v.number(),
    postings: v.array(v.object(postingFields)),
  }).index('runAgent', ['runId', 'agentId']),
  paperMarks: defineTable({
    runId: v.id('paperRuns'),
    agentId: v.string(),
    at: v.number(),
    equityUsd: v.union(v.string(), v.null()),
    priced: v.boolean(),
    components: v.array(
      v.object({
        asset: v.string(),
        quantity: v.string(),
        valueUsd: v.union(v.string(), v.null()),
        sourceTimestamp: v.union(v.number(), v.null()),
        status: v.string(),
      }),
    ),
  }).index('run', ['runId']),
  marketQuotes: defineTable({ ...quoteFields, scope: v.string() })
    .index('scopeInstrument', ['scope', 'instrumentId'])
    .index('quote', ['scope', 'quoteId']),
  marketCandles: defineTable({ ...candleFields, scope: v.string() }).index('scopeInstrument', [
    'scope',
    'instrumentId',
  ]),
  marketCapabilities: defineTable({
    ...capabilityFields,
    scope: v.string(),
    reviewReference: v.optional(v.string()),
    verifiedAt: v.number(),
  }).index('scopeInstrument', ['scope', 'instrumentId']),
  feedEvents: defineTable({
    instrumentId: v.string(),
    provider: v.string(),
    at: v.number(),
    status: v.string(),
    message: v.string(),
    diagnostic: v.optional(v.string()),
  }).index('instrument', ['instrumentId']),
  providerQuota: defineTable({
    provider: v.string(),
    day: v.string(),
    minute: v.number(),
    dailyUsed: v.number(),
    minuteUsed: v.number(),
    blockedUntil: v.number(),
  }).index('provider', ['provider']),
};
