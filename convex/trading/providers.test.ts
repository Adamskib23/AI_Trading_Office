import { INSTRUMENTS } from '../office/registry';
import { jest } from '@jest/globals';
import {
  parseKrakenCandles,
  parseKrakenQuote,
  parseTwelveCandles,
  parseTwelveQuote,
  validateCandles,
  KrakenProvider,
  ProviderClockError,
} from './providers';
const now = Date.parse('2026-10-15T14:00:00Z');
const btc = INSTRUMENTS.find((i) => i.symbol === 'BTC/USD')!,
  aapl = INSTRUMENTS.find((i) => i.symbol === 'AAPL')!;
test('Twelve Data quote uses last_quote_at, never the daily candle opening', () => {
  const q = parseTwelveQuote(
    { symbol: 'AAPL', currency: 'USD', timestamp: 1, last_quote_at: now / 1000 - 60, close: '100' },
    aapl,
    now,
  );
  expect(q.sourceTimestamp).toBe(now - 60_000);
  expect(q.bid).toBeUndefined();
  expect(q.sourceMode).toBe('indicative');
  expect(() =>
    parseTwelveQuote({ symbol: 'AAPL', timestamp: 1, close: '100' }, aapl, now),
  ).toThrow();
  expect(() =>
    parseTwelveQuote({ symbol: 'MSFT', last_quote_at: 1, close: '100' }, aapl, now),
  ).toThrow('SYMBOL');
});

test('Kraken refuses an hour-ahead server clock and preserves only numeric diagnostics', async () => {
  const originalFetch = globalThis.fetch;
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  globalThis.fetch = jest
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ result: { status: 'online' } })))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { unixtime: now / 1000 + 3600 } })),
    );
  try {
    await expect(new KrakenProvider().health()).rejects.toMatchObject({
      message: 'PROVIDER_CLOCK_SKEW',
      providerTimestamp: now + 3600_000,
      checkedAt: now,
    });
    expect(new ProviderClockError(now + 3600_000, now)).toBeInstanceOf(Error);
  } finally {
    globalThis.fetch = originalFetch;
    clock.mockRestore();
  }
});

test('Kraken accepts a synchronized clock but still refuses maintenance status', async () => {
  const originalFetch = globalThis.fetch;
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  globalThis.fetch = jest
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify({ result: { status: 'maintenance' } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ result: { unixtime: now / 1000 } })));
  try {
    expect(await new KrakenProvider().health()).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
    clock.mockRestore();
  }
});
test('Kraken timestamp comes from the actual trade, not the response clock', () => {
  const q = parseKrakenQuote(
    { result: { XXBTZUSD: [['50000', '1', now / 1000 - 1, 'b', 'm', '', 123]], last: 'cursor' } },
    btc,
    now,
  );
  expect(q.sourceTimestamp).toBe(now - 1000);
  expect(q.quoteId).toContain('123');
  expect(q.bid).toBeUndefined();
});

test('provider timeout covers a stalled response body, not only response headers', async () => {
  const originalFetch = globalThis.fetch;
  jest.useFakeTimers();
  globalThis.fetch = jest.fn<typeof fetch>().mockImplementation((_url, options) =>
    Promise.resolve({
      ok: true,
      json: () =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('body aborted')));
        }),
    } as Response),
  );
  try {
    const pending = expect(new KrakenProvider().health()).rejects.toThrow('PROVIDER_TIMEOUT');
    await jest.advanceTimersByTimeAsync(15_000);
    await pending;
  } finally {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  }
});
test('both providers exclude unfinished candles and validate OHLC bounds', () => {
  const twelve = parseTwelveCandles(
    {
      meta: { symbol: 'AAPL', interval: '1h' },
      values: [
        { datetime: '2026-10-15 13:00:00', open: '100', high: '102', low: '99', close: '101' },
        { datetime: '2026-10-15 14:00:00', open: '100', high: '102', low: '99', close: '101' },
      ],
    },
    aapl,
    now,
  );
  expect(twelve).toHaveLength(1);
  expect(twelve[0].adjustment).toBe('raw');
  const kraken = parseKrakenCandles(
    {
      result: {
        XXBTZUSD: [
          [now / 1000 - 3600, '100', '102', '99', '101', '100', '10', 1],
          [now / 1000, '100', '102', '99', '101', '100', '10', 1],
        ],
        last: 1,
      },
    },
    btc,
    now,
  );
  expect(kraken).toHaveLength(1);
  expect(() => validateCandles(twelve, now)).not.toThrow();
  twelve[0].low = '103';
  expect(() => validateCandles(twelve, now)).toThrow('INVALID_CANDLE');
});
