import { midnightInstruments, midnightWindow } from './polling';
import { initialAccount } from './engine';

test.each([
  ['2026-10-15T23:57:59Z', false],
  ['2026-10-15T23:58:00Z', true],
  ['2026-10-16T00:05:59Z', true],
  ['2026-10-16T00:06:00Z', false],
])('midnight refresh window at %s is bounded', (iso, active) => {
  expect(midnightWindow(Date.parse(iso))).toBe(active);
});

test('only open held assets and foreign cash need midnight refreshes; USD cash makes no requests', () => {
  const now = Date.parse('2026-10-16T00:00:00Z');
  const account = initialAccount(now);
  expect(midnightInstruments([account], now)).toEqual([]);
  account.positions = { 'us:SPY': '1', 'kraken:BTC/USD': '0.002', 'kraken:ETH/USD': '0' };
  account.cash.EUR = '90';
  account.cash.JPY = '100';
  expect(midnightInstruments([account, account], now)).toEqual([
    'fx:EUR/USD',
    'fx:USD/JPY',
    'kraken:BTC/USD',
  ]);
  expect(midnightInstruments([account], Date.parse('2026-10-16T12:00:00Z'))).toEqual([]);
  expect(midnightInstruments([account], Date.parse('2026-10-17T00:00:00Z'))).toEqual([
    'kraken:BTC/USD',
  ]);
});
