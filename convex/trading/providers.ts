import { D, decimal } from './math';
import type { Candle, MarketDataProvider, Quote } from './types';
import type { Instrument } from '../office/registry';
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('PROVIDER_INVALID_RESPONSE');
  return value as Record<string, unknown>;
};
const number = (value: unknown) => {
  const result = Number(value);
  if (!Number.isFinite(result) || value === null || value === '')
    throw new Error('PROVIDER_INVALID_NUMBER');
  return result;
};
const price = (value: unknown) => {
  if (typeof value !== 'string' || !decimal(value).gt(0)) throw new Error('PROVIDER_INVALID_PRICE');
  return value;
};
async function request(url: URL) {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch {
    throw new Error('PROVIDER_NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok)
    throw new Error(
      response.status === 429 ? 'PROVIDER_RATE_LIMIT' : `PROVIDER_HTTP_${response.status}`,
    );
  const data = object(await response.json());
  if (data.status === 'error' || (Array.isArray(data.error) && data.error.length))
    throw new Error('PROVIDER_REJECTED_REQUEST');
  return data;
}
export function parseTwelveQuote(raw: unknown, instrument: Instrument, received: number): Quote {
  const data = object(raw);
  if (data.symbol !== instrument.symbol) throw new Error('PROVIDER_SYMBOL_MISMATCH');
  if (data.currency !== undefined && data.currency !== instrument.quoteCurrency)
    throw new Error('PROVIDER_CURRENCY_MISMATCH');
  // timestamp is a candle-opening time (defaults to a daily candle), NOT the quote time.
  // last_quote_at is the conservative minute-resolution source clock. Never use retrievedAt instead.
  const sourceTimestamp = number(data.last_quote_at) * 1000;
  const last = price(data.close);
  return {
    quoteId: `twelve:${instrument.id}:${sourceTimestamp}:${last}`,
    instrumentId: instrument.id,
    provider: 'twelve',
    venue: typeof data.exchange === 'string' ? data.exchange : instrument.venue,
    currency: instrument.quoteCurrency,
    last,
    sourceTimestamp,
    retrievedAt: received,
    sourceMode: 'indicative',
    delayMs: 0,
    healthy: true,
  };
}
export function parseTwelveCandles(raw: unknown, instrument: Instrument, now: number): Candle[] {
  const data = object(raw),
    meta = object(data.meta);
  if (meta.symbol !== instrument.symbol || meta.interval !== '1h' || !Array.isArray(data.values))
    throw new Error('PROVIDER_CANDLE_MISMATCH');
  return data.values
    .map((value) => {
      const row = object(value);
      if (typeof row.datetime !== 'string') throw new Error('PROVIDER_INVALID_TIME');
      const start = Date.parse(row.datetime.replace(' ', 'T') + 'Z');
      if (!Number.isFinite(start)) throw new Error('PROVIDER_INVALID_TIME');
      return {
        instrumentId: instrument.id,
        provider: 'twelve',
        start,
        end: start + 3600_000,
        open: price(row.open),
        high: price(row.high),
        low: price(row.low),
        close: price(row.close),
        ...(typeof row.volume === 'string' ? { volume: row.volume } : {}),
        adjustment: 'raw' as const,
      };
    })
    .filter((c) => c.end <= now)
    .sort((a, b) => a.start - b.start);
}
export class TwelveProvider implements MarketDataProvider {
  constructor(private key: string) {}
  private url(endpoint: string, instrument: Instrument) {
    const url = new URL(`https://api.twelvedata.com/${endpoint}`);
    url.searchParams.set('apikey', this.key);
    url.searchParams.set('symbol', instrument.symbol);
    url.searchParams.set('timezone', 'UTC');
    return url;
  }
  health() {
    return Promise.resolve(!!this.key);
  }
  async getQuote(instrument: Instrument) {
    const url = this.url('quote', instrument);
    url.searchParams.set('interval', '1min');
    url.searchParams.set('prepost', 'false');
    return parseTwelveQuote(await request(url), instrument, Date.now());
  }
  async getClosedCandles(instrument: Instrument, now: number) {
    const url = this.url('time_series', instrument);
    url.searchParams.set('interval', '1h');
    url.searchParams.set('outputsize', '48');
    url.searchParams.set('adjust', 'none');
    return parseTwelveCandles(await request(url), instrument, now);
  }
}
const krakenPair = (instrument: Instrument) =>
  instrument.baseCurrency === 'BTC' ? 'XBTUSD' : `${instrument.baseCurrency}USD`;
function krakenRows(result: Record<string, unknown>, instrument: Instrument): unknown[] {
  const aliases: Record<string, string[]> = {
    BTC: ['XXBTZUSD', 'XBTUSD', 'BTC/USD'],
    ETH: ['XETHZUSD', 'ETHUSD', 'ETH/USD'],
    SOL: ['SOLUSD', 'SOL/USD'],
  };
  const rows = aliases[instrument.baseCurrency]
    ?.map((key) => result[key])
    .find((value) => Array.isArray(value));
  if (!Array.isArray(rows)) throw new Error('PROVIDER_SYMBOL_MISMATCH');
  return rows;
}
export function parseKrakenQuote(raw: unknown, instrument: Instrument, received: number): Quote {
  const data = object(raw),
    result = object(data.result);
  const rows = krakenRows(result, instrument);
  if (!Array.isArray(rows) || !rows.length) throw new Error('PROVIDER_NO_TRADES');
  const row = rows[rows.length - 1] as unknown[];
  const sourceTimestamp = Math.floor(number(row[2]) * 1000),
    last = price(row[0]);
  return {
    quoteId: `kraken:${instrument.id}:${String(row[6] ?? sourceTimestamp)}:${last}`,
    instrumentId: instrument.id,
    provider: 'kraken',
    venue: 'KRAKEN',
    currency: 'USD',
    sourceTimestamp,
    retrievedAt: received,
    last,
    sourceMode: 'live',
    delayMs: 0,
    healthy: true,
  };
}
export function parseKrakenCandles(raw: unknown, instrument: Instrument, now: number): Candle[] {
  const result = object(object(raw).result);
  const rows = krakenRows(result, instrument);
  if (!Array.isArray(rows)) throw new Error('PROVIDER_NO_CANDLES');
  return rows
    .slice(0, -1)
    .map((value: unknown) => {
      if (!Array.isArray(value)) throw new Error('PROVIDER_INVALID_CANDLE');
      const start = number(value[0]) * 1000;
      return {
        instrumentId: instrument.id,
        provider: 'kraken',
        start,
        end: start + 3600_000,
        open: price(value[1]),
        high: price(value[2]),
        low: price(value[3]),
        close: price(value[4]),
        volume: String(value[6]),
        adjustment: 'raw' as const,
      };
    })
    .filter((c) => c.end <= now)
    .slice(-48);
}
export function validateCandles(candles: Candle[], now: number) {
  for (const c of candles)
    if (
      c.end > now ||
      c.start >= c.end ||
      !Number.isFinite(c.start) ||
      !Number.isFinite(c.end) ||
      decimal(c.low).gt(c.high) ||
      decimal(c.open).lt(c.low) ||
      decimal(c.open).gt(c.high) ||
      decimal(c.close).lt(c.low) ||
      decimal(c.close).gt(c.high) ||
      [c.open, c.high, c.low, c.close].some((p) => !decimal(p).gt(0)) ||
      (c.volume !== undefined && (!new D(c.volume).isFinite() || new D(c.volume).lt(0)))
    )
      throw new Error('PROVIDER_INVALID_CANDLE');
}
export class KrakenProvider implements MarketDataProvider {
  async health() {
    const data = await request(new URL('https://api.kraken.com/0/public/SystemStatus'));
    const time = await request(new URL('https://api.kraken.com/0/public/Time'));
    if (Math.abs(number(object(time.result).unixtime) * 1000 - Date.now()) > 5000)
      throw new Error('PROVIDER_CLOCK_SKEW');
    return object(data.result).status === 'online';
  }
  async getQuote(instrument: Instrument) {
    const url = new URL('https://api.kraken.com/0/public/Trades');
    url.searchParams.set('pair', krakenPair(instrument));
    url.searchParams.set('count', '1');
    return parseKrakenQuote(await request(url), instrument, Date.now());
  }
  async getClosedCandles(instrument: Instrument, now: number) {
    const url = new URL('https://api.kraken.com/0/public/OHLC');
    url.searchParams.set('pair', krakenPair(instrument));
    url.searchParams.set('interval', '60');
    return parseKrakenCandles(await request(url), instrument, now);
  }
}
