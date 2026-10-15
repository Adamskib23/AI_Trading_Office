import { canRefreshOrder } from './refresh';

test('pending refresh is bounded by order expiry and the TEST deadline', () => {
  const order = { expiresAt: 180_000 };
  const run = { mode: 'PROVIDER', status: 'ACTIVE', stopAt: 170_000 };
  expect(canRefreshOrder(order, run, 65_000)).toBe(true);
  expect(canRefreshOrder(order, run, 130_000)).toBe(true);
  expect(canRefreshOrder(order, run, 170_000)).toBe(false);
  expect(canRefreshOrder(order, { ...run, stopAt: undefined }, 180_000)).toBe(false);
  expect(canRefreshOrder(order, { ...run, stopAt: undefined }, 195_000)).toBe(false);
});

test('fixtures, missing runs and paused or completed TESTs never fetch providers', () => {
  const order = { expiresAt: 180_000 };
  expect(canRefreshOrder(order, null, 65_000)).toBe(false);
  expect(canRefreshOrder(order, { mode: 'FIXTURE', status: 'ACTIVE' }, 65_000)).toBe(false);
  for (const status of ['PAUSED', 'COMPLETED'])
    expect(canRefreshOrder(order, { mode: 'PROVIDER', status }, 65_000)).toBe(false);
});
