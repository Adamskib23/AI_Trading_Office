import {
  evaluate,
  fundingPostings,
  initialAccount,
  markAccount,
  reconcile,
  utcDay,
} from './engine';
import { decimal } from './math';
import type { Account, Proposal } from './types';
import { fixtureContext, NOW } from './testFixtures';
const buy = (overrides: Partial<Proposal> = {}): Proposal => ({
  agentId: 'alex',
  cycleId: 'cycle',
  proposalIndex: 0,
  instrumentId: 'us:AAPL',
  action: 'BUY',
  quantity: '1',
  ...overrides,
});
const convert = (overrides: Partial<Proposal> = {}): Proposal => ({
  agentId: 'sophie',
  cycleId: 'cycle',
  proposalIndex: 0,
  instrumentId: 'fx:EUR/USD',
  action: 'CONVERT_CURRENCY',
  amountFrom: '100',
  fromCurrency: 'USD',
  toCurrency: 'EUR',
  ...overrides,
});
const result = (a: Account = initialAccount(NOW), p = buy(), c = fixtureContext()) =>
  evaluate(a, p, c, true);

describe('decimal, multi-market paper settlement', () => {
  test.each(['us:AAPL', 'us:SPY', 'us:GLD', 'kraken:SOL/USD'])(
    '%s buys settle with balanced ledger and fees',
    (id) => {
      const account = initialAccount(NOW),
        fill = result(account, buy({ instrumentId: id }));
      expect(fill.reason).toBe('FILLED');
      expect(decimal(fill.account!.cash.USD).lt('900')).toBe(true);
      expect(reconcile(fill.account!, [...fundingPostings(), ...fill.postings!])).toBe(true);
      expect(fill.feeCurrency).toBe('USD');
    },
  );
  test('fractional shares and exact decimal replay; no binary floats in balances', () => {
    const first = result(initialAccount(NOW), buy({ quantity: '0.2' }));
    expect(first.accepted).toBe(true);
    expect(first.account!.positions['us:AAPL']).toBe('0.200000');
    const second = result(first.account, buy({ action: 'SELL', quantity: '0.2' }));
    expect(second.accepted).toBe(true);
    expect(second.account!.positions['us:AAPL']).toBe('0.000000');
    expect(
      reconcile(second.account!, [...fundingPostings(), ...first.postings!, ...second.postings!]),
    ).toBe(true);
    expect(decimal(second.account!.cash.USD).lt('1000')).toBe(true);
  });
  test('FX converts owned cash, reverses at the correct side, and reconciles', () => {
    const first = result(initialAccount(NOW), convert());
    expect(first.accepted).toBe(true);
    expect(first.account!.cash.EUR).toBe('90.84');
    const second = result(
      first.account,
      convert({ fromCurrency: 'EUR', toCurrency: 'USD', amountFrom: '50' }),
    );
    expect(second.accepted).toBe(true);
    expect(
      reconcile(second.account!, [...fundingPostings(), ...first.postings!, ...second.postings!]),
    ).toBe(true);
  });
  test('JPY uses integer cash units and fees in the source currency', () => {
    const first = result(
      initialAccount(NOW),
      convert({ instrumentId: 'fx:USD/JPY', toCurrency: 'JPY' }),
    );
    expect(first.accepted).toBe(true);
    expect(first.account!.cash.JPY).toMatch(/^\d+$/);
    const second = result(
      first.account,
      convert({
        instrumentId: 'fx:USD/JPY',
        fromCurrency: 'JPY',
        toCurrency: 'USD',
        amountFrom: '10000',
      }),
    );
    expect(second.accepted).toBe(true);
    expect(second.fee).toBe('5');
    expect(second.feeCurrency).toBe('JPY');
    expect(
      reconcile(second.account!, [...fundingPostings(), ...first.postings!, ...second.postings!]),
    ).toBe(true);
  });
  test('observed bid/ask are used without adding an invented spread', () => {
    const context = fixtureContext();
    context.quotes['us:AAPL'].bid = '99';
    context.quotes['us:AAPL'].ask = '101';
    const fill = result(initialAccount(NOW), buy(), context);
    expect(fill.price).toBe('101.0505000000');
    expect(fill.spreadCost).toBe('1.00000000');
  });
});
describe('automatic risk and provenance checks', () => {
  test.each(['0', '-1', 'NaN', 'Infinity', '1e2', '0.0000001'])(
    'rejects malformed/overspecified quantity %s',
    (quantity) => expect(result(initialAccount(NOW), buy({ quantity })).accepted).toBe(false),
  );
  test('minimum and maximum order size', () => {
    expect(result(initialAccount(NOW), buy({ quantity: '0.01' })).reason).toBe('NOTIONAL_LIMIT');
    expect(result(initialAccount(NOW), buy({ quantity: '2' })).reason).toBe('NOTIONAL_LIMIT');
  });
  test('no borrowed cash, shorts or mismatched currency pairs', () => {
    const account = initialAccount(NOW);
    account.cash.USD = '20.00';
    account.positions['us:GLD'] = '9.8';
    expect(result(account).reason).toBe('INSUFFICIENT_CASH');
    expect(result(initialAccount(NOW), buy({ action: 'SELL' })).reason).toBe(
      'INSUFFICIENT_POSITION',
    );
    expect(
      result(initialAccount(NOW), convert({ fromCurrency: 'EUR', toCurrency: 'GBP' })).reason,
    ).toBe('INVALID_FX_PAIR');
    expect(
      result(initialAccount(NOW), convert({ fromCurrency: 'EUR', toCurrency: 'USD' })).reason,
    ).toBe('INSUFFICIENT_CASH');
  });
  test('calendar closures are enforced for equities and FX; crypto stays available', () => {
    const saturday = Date.parse('2026-10-17T14:00:00Z'),
      context = fixtureContext(saturday);
    expect(result(initialAccount(saturday), buy(), context).reason).toBe('MARKET_CLOSED');
    expect(result(initialAccount(saturday), convert(), context).reason).toBe('MARKET_CLOSED');
    expect(
      result(initialAccount(saturday), buy({ instrumentId: 'kraken:SOL/USD' }), context).accepted,
    ).toBe(true);
  });
  test.each(['stale', 'future', 'delayed', 'outage', 'wrong-currency', 'fixture-in-provider'])(
    'blocks %s quotes',
    (problem) => {
      const context = fixtureContext(),
        q = context.quotes['us:AAPL'];
      if (problem === 'stale') q.sourceTimestamp -= 180_000;
      if (problem === 'future') q.sourceTimestamp = NOW + 1;
      if (problem === 'delayed') q.sourceMode = 'delayed';
      if (problem === 'outage') q.healthy = false;
      if (problem === 'wrong-currency') q.currency = 'EUR';
      if (problem === 'fixture-in-provider') context.mode = 'PROVIDER';
      expect(result(initialAccount(NOW), buy(), context).accepted).toBe(false);
    },
  );
  test('rights, sessions, candles and corporate-action review cannot be bypassed', () => {
    for (const field of ['rightsVerified', 'sessionVerified', 'candlesVerified'] as const) {
      const context = fixtureContext();
      context.capabilities['us:AAPL'][field] = false;
      expect(result(initialAccount(NOW), buy(), context).reason).toBe('FEED_NOT_VERIFIED');
    }
    const context = fixtureContext();
    context.capabilities['us:AAPL'].corporateActionsClearUntil = NOW - 1;
    expect(result(initialAccount(NOW), buy(), context).reason).toBe(
      'CORPORATE_ACTION_REVIEW_REQUIRED',
    );
  });
  test('drawdown, daily fill limit, pause and UTC rollover stop new orders', () => {
    const account = initialAccount(NOW);
    account.cash.USD = '940';
    expect(result(account).reason).toBe('DRAWDOWN_STOP');
    account.cash.USD = '1000';
    account.filledToday = 6;
    expect(result(account).reason).toBe('DAILY_TRADE_LIMIT');
    account.filledToday = 0;
    account.paused = true;
    expect(result(account).reason).toBe('PAUSED');
    account.paused = false;
    account.riskDay = '2026-10-14';
    expect(result(account).reason).toBe('UTC_DAY_BASELINE_REQUIRED');
  });
  test('asset and class limits include existing exposure and transaction costs', () => {
    const account = initialAccount(NOW);
    account.cash.USD = '750';
    account.positions['us:AAPL'] = '2.5';
    expect(result(account).reason).toBe('ASSET_CONCENTRATION');
    account.cash.USD = '410';
    account.positions = { 'us:AAPL': '2', 'us:MSFT': '2', 'us:NVDA': '1.9' };
    expect(result(account, buy({ instrumentId: 'us:NVDA', quantity: '0.2' })).reason).toBe(
      'CLASS_CONCENTRATION',
    );
  });
  test('replay detects tampering; an unpriced asset never gets an invented value', () => {
    const account = initialAccount(NOW);
    account.cash.USD = '1000.01';
    expect(reconcile(account, fundingPostings())).toBe(false);
    account.positions['us:AAPL'] = '1';
    const context = fixtureContext();
    delete context.quotes['us:AAPL'];
    expect(markAccount(account, context).equityUsd).toBe(null);
  });
  test('closed last marks remain timestamped; corporate-action uncertainty makes holdings unpriced', () => {
    const saturday = Date.parse('2026-10-17T14:00:00Z'),
      context = fixtureContext(saturday),
      account = initialAccount(saturday);
    account.positions['us:AAPL'] = '1';
    context.quotes['us:AAPL'].sourceTimestamp -= 86400_000;
    expect(
      markAccount(account, context).components.find((c) => c.asset === 'us:AAPL')?.status,
    ).toBe('CLOSED_LAST_MARK');
    context.capabilities['us:AAPL'].corporateActionsClearUntil = saturday - 1;
    expect(markAccount(account, context).priced).toBe(false);
    expect(utcDay(saturday)).toBe('2026-10-17');
  });
});
