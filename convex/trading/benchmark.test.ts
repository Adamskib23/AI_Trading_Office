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

test('a restart preserves purchased legs while a recovered source only buys pending sleeves', () => {
  const saturday = Date.parse('2026-10-17T14:00:00Z');
  const state = initialBenchmark(saturday - 2000);
  const weekend = advanceBenchmark(state, fixtureContext(saturday));
  expect(weekend.legs.filter((l) => l.filledAt)).toHaveLength(1);
  const stored = JSON.parse(JSON.stringify(weekend)) as typeof weekend;
  const monday = Date.parse('2026-10-19T14:00:00Z');
  const recovered = advanceBenchmark(stored, fixtureContext(monday));
  expect(recovered.legs.filter((l) => l.filledAt)).toHaveLength(4);
  expect(recovered.legs.find((l) => l.instrumentId === 'kraken:BTC/USD')).toEqual(
    weekend.legs.find((l) => l.instrumentId === 'kraken:BTC/USD'),
  );
  expect(advanceBenchmark(recovered, fixtureContext(monday))).toEqual(recovered);
  expect(markAccount(recovered.account, fixtureContext(monday)).priced).toBe(true);
  expect(state.legs.every((l) => !l.filledAt)).toBe(true);
});

test('an outage or stale quote leaves a sleeve in cash until a later eligible source returns', () => {
  const context = fixtureContext(NOW + 2000);
  const state = initialBenchmark(NOW);
  context.quotes['us:SPY'].healthy = false;
  context.quotes['us:GLD'].sourceTimestamp = NOW - 180_000;
  const partial = advanceBenchmark(state, context);
  expect(partial.legs.filter((l) => l.filledAt)).toHaveLength(2);
  expect(Number(partial.account.cash.USD)).toBeGreaterThan(500);
  const recovered = advanceBenchmark(partial, fixtureContext(NOW + 3000));
  expect(recovered.legs.filter((l) => l.filledAt)).toHaveLength(4);
  expect(Number(recovered.account.cash.USD)).toBeGreaterThanOrEqual(0);
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
