import { rolloverDay } from './rollover';
import { evaluate, initialAccount, markAccount } from './engine';
import { fixtureContext } from './testFixtures';

const midnight = Date.parse('2026-10-16T00:00:00Z');
const account = () => ({ ...initialAccount(midnight - 60_000), filledToday: 6 });
const context = fixtureContext(midnight + 60_000);
const mark = markAccount(initialAccount(midnight), context);
const witness = { at: midnight - 60_000, priced: true, equityUsd: '1000.00000000' };

test('UTC rollover resets the daily counter once and retains capital and cash', () => {
  const before = account();
  const patch = rolloverDay(before, mark, witness, context.now)!;
  expect(patch).toEqual({
    riskDay: '2026-10-16',
    filledToday: 0,
    dailyBaselineUsd: '1000.00000000',
  });
  const after = { ...before, ...patch };
  expect(after.cash).toEqual(before.cash);
  expect(after.initialUsd).toBe('1000.00');
  expect(rolloverDay(after, mark, witness, context.now)).toBeNull();
});

test('restart after midnight cannot erase a loss since the midnight witness', () => {
  const before = account();
  before.cash.USD = '940.00';
  const lossMark = markAccount(before, context);
  const patch = rolloverDay(before, lossMark, witness, context.now)!;
  expect(patch.dailyBaselineUsd).toBe('1000.00000000');
  const decision = evaluate(
    { ...before, ...patch },
    {
      agentId: 'alex',
      cycleId: 'rollover',
      proposalIndex: 0,
      instrumentId: 'kraken:BTC/USD',
      action: 'BUY',
      quantity: '0.0003',
    },
    context,
  );
  expect(decision.reason).toBe('DRAWDOWN_STOP');
});

test('larger current equity raises the conservative baseline', () => {
  expect(
    rolloverDay(account(), { ...mark, equityUsd: '1020' }, witness, context.now)?.dailyBaselineUsd,
  ).toBe('1020');
});

test.each(['missing', 'stale', 'future', 'unpriced', 'multiple-days', 'unpriced-current'])(
  'rollover blocks %s evidence instead of inventing a baseline',
  (problem) => {
    const before = account();
    const saved = { ...witness };
    const current = { ...mark };
    if (problem === 'stale') saved.at = midnight - 300_001;
    if (problem === 'future') saved.at = context.now + 1;
    if (problem === 'unpriced') saved.priced = false;
    if (problem === 'multiple-days') before.riskDay = '2026-10-14';
    if (problem === 'unpriced-current') current.priced = false;
    expect(
      rolloverDay(before, current, problem === 'missing' ? null : saved, context.now),
    ).toBeNull();
  },
);
