import { advanceBenchmark, initialBenchmark } from './benchmark';
import { markAccount } from './engine';
import { fixtureContext, NOW } from './testFixtures';
test('passive basket waits for later eligible quotes and acquires four equal-budget sleeves', () => {
  const context = fixtureContext(),
    state = initialBenchmark(NOW);
  expect(advanceBenchmark(state, context).legs.every((l) => !l.filledAt)).toBe(true);
  context.now = NOW + 2000;
  for (const quote of Object.values(context.quotes)) {
    quote.sourceTimestamp = NOW + 1000;
    quote.retrievedAt = NOW + 1500;
  }
  const invested = advanceBenchmark(state, context);
  expect(invested.legs.filter((l) => l.filledAt)).toHaveLength(4);
  expect(Number(invested.account.cash.USD)).toBeGreaterThanOrEqual(0);
  expect(Number(invested.account.cash.USD)).toBeLessThan(1);
  expect(markAccount(invested.account, context).priced).toBe(true);
  expect(advanceBenchmark(invested, context)).toEqual(invested);
});
test('closed securities do not get fictitious weekend benchmark fills', () => {
  const saturday = Date.parse('2026-10-17T14:00:00Z'),
    context = fixtureContext(saturday);
  const state = initialBenchmark(saturday - 2000);
  const result = advanceBenchmark(state, context);
  expect(result.legs.find((l) => l.instrumentId === 'us:SPY')?.filledAt).toBeUndefined();
  expect(result.legs.find((l) => l.instrumentId === 'us:GLD')?.filledAt).toBeUndefined();
  expect(result.legs.find((l) => l.instrumentId === 'fx:EUR/USD')?.filledAt).toBeUndefined();
  expect(result.legs.find((l) => l.instrumentId === 'kraken:BTC/USD')?.filledAt).toBe(saturday);
});
