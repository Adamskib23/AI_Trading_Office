import { INSTRUMENTS, Instrument } from '../office/registry';
import { marketState } from '../office/calendar';
import { D, decimal, cash, positive, cashPrecision } from './math';
import type {
  Account,
  Context,
  Currency,
  Execution,
  Mark,
  Posting,
  Proposal,
  Quote,
} from './types';

export const POLICY_VERSION = 'paper-v1';
export const FEES = {
  stock: { spreadBps: 10, slippageBps: 5, feeBps: 5 },
  etf: { spreadBps: 10, slippageBps: 5, feeBps: 5 },
  fx: { spreadBps: 10, slippageBps: 2, feeBps: 5 },
  crypto: { spreadBps: 20, slippageBps: 10, feeBps: 10 },
};
export const MAX_QUOTE_AGE = 120_000;
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
export const initialAccount = (now: number): Account => ({
  cash: { USD: '1000.00', EUR: '0.00', GBP: '0.00', JPY: '0' },
  positions: {},
  initialUsd: '1000.00',
  dailyBaselineUsd: '1000.00',
  riskDay: utcDay(now),
  filledToday: 0,
  paused: false,
});
export function validQuote(q: Quote, now: number) {
  if (
    !Number.isFinite(q.sourceTimestamp) ||
    !Number.isFinite(q.retrievedAt) ||
    q.sourceTimestamp > q.retrievedAt ||
    q.retrievedAt > now ||
    q.sourceTimestamp > now ||
    !Number.isFinite(q.delayMs) ||
    q.delayMs < 0
  )
    throw new Error('INVALID_QUOTE_TIME');
  if (
    !decimal(q.last).gt(0) ||
    (q.bid !== undefined && !decimal(q.bid).gt(0)) ||
    (q.ask !== undefined && !decimal(q.ask).gt(0)) ||
    (q.bid !== undefined && q.ask !== undefined && decimal(q.bid).gt(q.ask))
  )
    throw new Error('INVALID_PRICE');
}
function session(instrument: Instrument, ctx: Context) {
  const state = marketState(instrument.calendarId, ctx.now).state;
  if (state === 'CLOSED') return false;
  if (state === 'OPEN') return true;
  // Fixture tests use an explicitly certified test session; provider FX must be separately verified.
  return instrument.assetClass === 'fx' && !!ctx.capabilities[instrument.id]?.sessionVerified;
}
function usable(q: Quote, instrument: Instrument, ctx: Context) {
  validQuote(q, ctx.now);
  return (
    q.instrumentId === instrument.id &&
    q.currency === instrument.quoteCurrency &&
    q.healthy &&
    ctx.now - q.sourceTimestamp <= MAX_QUOTE_AGE &&
    q.delayMs === 0 &&
    (ctx.mode === 'FIXTURE' ? q.sourceMode === 'fixture' : q.sourceMode === 'live')
  );
}
function closedMark(q: Quote, instrument: Instrument, ctx: Context) {
  return (
    q.instrumentId === instrument.id &&
    q.currency === instrument.quoteCurrency &&
    q.healthy &&
    ctx.now - q.sourceTimestamp <= 4 * 86400_000 &&
    (ctx.mode === 'FIXTURE' ? q.sourceMode === 'fixture' : q.sourceMode !== 'fixture')
  );
}
function usdRate(
  currency: Currency,
  ctx: Context,
): { rate: InstanceType<typeof D>; quote?: Quote } | null {
  if (currency === 'USD') return { rate: new D(1) };
  const symbol = currency === 'JPY' ? 'USD/JPY' : `${currency}/USD`;
  const instrument = INSTRUMENTS.find((i) => i.symbol === symbol)!;
  const quote = ctx.quotes[instrument.id];
  if (!quote) return null;
  validQuote(quote, ctx.now);
  const closed = marketState(instrument.calendarId, ctx.now).state === 'CLOSED';
  if (!closed && !usable(quote, instrument, ctx)) return null;
  if (closed && !closedMark(quote, instrument, ctx)) return null;
  return { rate: currency === 'JPY' ? new D(1).div(quote.last) : decimal(quote.last), quote };
}
export function markAccount(account: Account, ctx: Context): Mark {
  const components: Mark['components'] = [];
  let equity = new D(0);
  let priced = true;
  const exposure: Record<string, string> = {},
    classExposure: Record<string, string> = {};
  for (const [currency, amount] of Object.entries(account.cash)) {
    if (decimal(amount).isZero()) continue;
    const conversion = usdRate(currency as Currency, ctx);
    const value = conversion ? decimal(amount).mul(conversion.rate) : null;
    if (value) equity = equity.add(value);
    else priced = false;
    const closed = conversion?.quote && marketState('fx-reference', ctx.now).state === 'CLOSED';
    components.push({
      asset: currency,
      quantity: amount,
      valueUsd: value?.toFixed(8) ?? null,
      sourceTimestamp: conversion?.quote?.sourceTimestamp ?? null,
      status: !value
        ? 'MISSING_OR_STALE'
        : currency === 'USD'
          ? 'CASH'
          : closed
            ? 'CLOSED_LAST_MARK'
            : 'FRESH',
    });
    if (value && currency !== 'USD') {
      exposure[currency] = value.toFixed(8);
      classExposure.fx = new D(classExposure.fx ?? 0).add(value).toFixed(8);
    }
  }
  for (const [id, quantity] of Object.entries(account.positions)) {
    if (decimal(quantity).isZero()) continue;
    const instrument = INSTRUMENTS.find((i) => i.id === id);
    const quote = ctx.quotes[id];
    let value: InstanceType<typeof D> | null = null;
    let status: Mark['components'][number]['status'] = 'MISSING_OR_STALE';
    if (instrument && quote) {
      validQuote(quote, ctx.now);
      const closed = marketState(instrument.calendarId, ctx.now).state === 'CLOSED';
      const corporateClear =
        instrument.assetClass === 'crypto' ||
        (ctx.capabilities[id]?.corporateActionsClearUntil ?? 0) >= ctx.now;
      if (
        corporateClear &&
        (usable(quote, instrument, ctx) || (closed && closedMark(quote, instrument, ctx)))
      ) {
        value = decimal(quantity).mul(quote.last);
        status = closed ? 'CLOSED_LAST_MARK' : 'FRESH';
        exposure[id] = value.toFixed(8);
        // Commodity-linked funds remain ETFs for the 60% asset-class cap.
        const cls = instrument.assetClass;
        classExposure[cls] = new D(classExposure[cls] ?? 0).add(value).toFixed(8);
      }
    }
    if (value) equity = equity.add(value);
    else priced = false;
    components.push({
      asset: id,
      quantity,
      valueUsd: value?.toFixed(8) ?? null,
      sourceTimestamp: quote?.sourceTimestamp ?? null,
      status,
    });
  }
  return {
    equityUsd: priced ? equity.toFixed(8) : null,
    priced,
    components,
    exposure,
    classExposure,
  };
}
function postingPair(
  asset: string,
  delta: string,
  counterparty: Posting['account'] = 'clearing',
): Posting[] {
  return [
    { asset, account: 'agent', delta },
    { asset, account: counterparty, delta: decimal(delta).neg().toFixed() },
  ];
}
export function reconcile(account: Account, postings: Posting[]) {
  const balances: Record<string, InstanceType<typeof D>> = {};
  const totals: Record<string, InstanceType<typeof D>> = {};
  for (const posting of postings) {
    totals[posting.asset] = new D(totals[posting.asset] ?? 0).add(posting.delta);
    if (posting.account === 'agent')
      balances[posting.asset] = new D(balances[posting.asset] ?? 0).add(posting.delta);
  }
  for (const total of Object.values(totals)) if (!total.isZero()) return false;
  const actual = { ...account.cash, ...account.positions };
  for (const asset of new Set([...Object.keys(actual), ...Object.keys(balances)]))
    if (!new D(actual[asset as keyof typeof actual] ?? 0).eq(balances[asset] ?? 0)) return false;
  return true;
}
export const fundingPostings = (): Posting[] => postingPair('USD', '1000.00', 'funding');

// Same pure validator is run at proposal and on the later quote before atomic settlement.
export function evaluate(
  account: Account,
  proposal: Proposal,
  ctx: Context,
  fill = false,
): Execution {
  try {
    if (!['BUY', 'SELL', 'CONVERT_CURRENCY'].includes(proposal.action))
      return { accepted: false, reason: 'INVALID_ORDER' };
    if (ctx.globalPaused || account.paused) return { accepted: false, reason: 'PAUSED' };
    if (account.riskDay !== utcDay(ctx.now))
      return { accepted: false, reason: 'UTC_DAY_BASELINE_REQUIRED' };
    if (account.filledToday >= 6) return { accepted: false, reason: 'DAILY_TRADE_LIMIT' };
    const instrument = INSTRUMENTS.find((i) => i.id === proposal.instrumentId);
    if (!instrument || !ctx.selected.includes(instrument.id))
      return { accepted: false, reason: 'INSTRUMENT_DISABLED' };
    const capability = ctx.capabilities[instrument.id];
    if (
      !capability?.quoteVerified ||
      !capability.candlesVerified ||
      !capability.rightsVerified ||
      !capability.sessionVerified
    )
      return { accepted: false, reason: 'FEED_NOT_VERIFIED' };
    if (instrument.assetClass === 'stock' || instrument.assetClass === 'etf')
      if (capability.corporateActionsClearUntil < ctx.now)
        return { accepted: false, reason: 'CORPORATE_ACTION_REVIEW_REQUIRED' };
    if (
      marketState(instrument.calendarId, ctx.now).state === 'UNVERIFIED' &&
      instrument.assetClass !== 'fx'
    )
      return { accepted: false, reason: 'SESSION_UNVERIFIED' };
    if (!session(instrument, ctx)) return { accepted: false, reason: 'MARKET_CLOSED' };
    const quote = ctx.quotes[instrument.id];
    if (!quote || !usable(quote, instrument, ctx) || quote.provider !== capability.provider)
      return { accepted: false, reason: 'QUOTE_UNAVAILABLE_OR_STALE' };
    const before = markAccount(account, ctx);
    if (!before.priced || before.equityUsd === null)
      return { accepted: false, reason: 'PORTFOLIO_UNPRICED' };
    if (
      decimal(before.equityUsd).lte(decimal(account.initialUsd).mul('0.85')) ||
      decimal(before.equityUsd).lte(decimal(account.dailyBaselineUsd).mul('0.95'))
    )
      return { accepted: false, reason: 'DRAWDOWN_STOP' };
    const after: Account = {
      ...account,
      cash: { ...account.cash },
      positions: { ...account.positions },
      filledToday: account.filledToday + (fill ? 1 : 0),
    };
    const fees = FEES[instrument.assetClass];
    const reference = decimal(quote.last);
    let buying = true;
    let amount: InstanceType<typeof D>;
    let currency: Currency = 'USD';
    let destination: Currency | undefined;
    if (proposal.action === 'CONVERT_CURRENCY') {
      if (
        instrument.assetClass !== 'fx' ||
        !proposal.fromCurrency ||
        !proposal.toCurrency ||
        proposal.quantity !== undefined
      )
        return { accepted: false, reason: 'INVALID_FX_CONVERSION' };
      currency = proposal.fromCurrency;
      destination = proposal.toCurrency;
      if (
        currency === destination ||
        !(
          [instrument.baseCurrency, instrument.quoteCurrency].includes(currency) &&
          [instrument.baseCurrency, instrument.quoteCurrency].includes(destination)
        )
      )
        return { accepted: false, reason: 'INVALID_FX_PAIR' };
      amount = positive(proposal.amountFrom, cashPrecision(currency));
      buying = currency === instrument.quoteCurrency;
    } else {
      if (
        instrument.assetClass === 'fx' ||
        proposal.amountFrom !== undefined ||
        proposal.fromCurrency !== undefined ||
        proposal.toCurrency !== undefined
      )
        return { accepted: false, reason: 'INVALID_ORDER' };
      amount = positive(proposal.quantity, instrument.quantityPrecision);
      buying = proposal.action === 'BUY';
    }
    const side = buying ? quote.ask : quote.bid;
    const spread =
      side === undefined
        ? reference.mul(fees.spreadBps).div(20_000)
        : quote.bid !== undefined && quote.ask !== undefined
          ? decimal(quote.ask).sub(quote.bid).div(2)
          : new D(0);
    const base =
      side !== undefined ? decimal(side) : buying ? reference.add(spread) : reference.sub(spread);
    const slippage = base.mul(fees.slippageBps).div(10_000);
    const price = (buying ? base.add(slippage) : base.sub(slippage)).toDecimalPlaces(
      10,
      buying ? D.ROUND_CEIL : D.ROUND_FLOOR,
    );
    if (!price.gt(0)) return { accepted: false, reason: 'INVALID_PRICE' };
    const rate = usdRate(currency, ctx);
    if (!rate) return { accepted: false, reason: 'FX_VALUATION_MISSING' };
    const notional =
      proposal.action === 'CONVERT_CURRENCY' ? amount.mul(rate.rate) : amount.mul(price);
    if (notional.lt(10) || notional.gt(200)) return { accepted: false, reason: 'NOTIONAL_LIMIT' };
    const postings: Posting[] = [];
    let quantity = amount;
    let gross: InstanceType<typeof D>;
    let fee: InstanceType<typeof D>;
    if (destination) {
      // Fee charged in the source currency; target rounded down, never manufactured cash.
      fee = new D(cash(amount.mul(fees.feeBps).div(10_000), currency, D.ROUND_CEIL));
      gross = amount;
      const sourceTotal = amount.add(fee);
      if (decimal(after.cash[currency]).lt(sourceTotal))
        return { accepted: false, reason: 'INSUFFICIENT_CASH' };
      const target = cash(
        buying ? amount.div(price) : amount.mul(price),
        destination,
        D.ROUND_FLOOR,
      );
      if (!decimal(target).gt(0)) return { accepted: false, reason: 'ROUNDING_TO_ZERO' };
      after.cash[currency] = cash(decimal(after.cash[currency]).sub(sourceTotal), currency);
      after.cash[destination] = cash(decimal(after.cash[destination]).add(target), destination);
      postings.push(
        ...postingPair(currency, amount.neg().toFixed()),
        ...postingPair(currency, fee.neg().toFixed(), 'fees'),
        ...postingPair(destination, target),
      );
      quantity = decimal(target);
    } else {
      const rawGross = amount.mul(price);
      gross = new D(cash(rawGross, 'USD', buying ? D.ROUND_CEIL : D.ROUND_FLOOR));
      fee = new D(cash(gross.mul(fees.feeBps).div(10_000), 'USD', D.ROUND_CEIL));
      const held = new D(after.positions[instrument.id] ?? 0);
      if (!buying && held.lt(amount)) return { accepted: false, reason: 'INSUFFICIENT_POSITION' };
      const delta = buying ? gross.add(fee).neg() : gross.sub(fee);
      if (new D(after.cash.USD).add(delta).lt(0))
        return { accepted: false, reason: 'INSUFFICIENT_CASH' };
      after.cash.USD = cash(new D(after.cash.USD).add(delta), 'USD');
      after.positions[instrument.id] = (buying ? held.add(amount) : held.sub(amount)).toFixed(
        instrument.quantityPrecision,
      );
      postings.push(
        ...postingPair(instrument.id, buying ? amount.toFixed() : amount.neg().toFixed()),
        ...postingPair('USD', buying ? gross.neg().toFixed() : gross.toFixed()),
        ...postingPair('USD', fee.neg().toFixed(), 'fees'),
      );
    }
    const mark = markAccount(after, ctx);
    if (!mark.priced || mark.equityUsd === null)
      return { accepted: false, reason: 'PORTFOLIO_UNPRICED' };
    // Limits govern risk-increasing buys/conversions; sales may reduce a breached exposure.
    if (buying || destination) {
      const asset = destination ?? instrument.id;
      if (decimal(mark.exposure[asset] ?? '0').gt(decimal(mark.equityUsd).mul('0.30')))
        return { accepted: false, reason: 'ASSET_CONCENTRATION' };
      for (const exposure of Object.values(mark.classExposure))
        if (decimal(exposure).gt(decimal(mark.equityUsd).mul('0.60')))
          return { accepted: false, reason: 'CLASS_CONCENTRATION' };
    }
    const units = destination && buying ? amount.div(price) : amount;
    const quoteUsd = usdRate(instrument.quoteCurrency as Currency, ctx);
    if (!quoteUsd) return { accepted: false, reason: 'FX_VALUATION_MISSING' };
    return {
      accepted: true,
      reason: fill ? 'FILLED' : 'ACCEPTED',
      account: after,
      postings,
      price: price.toFixed(10),
      quantity: quantity.toFixed(),
      gross: gross.toFixed(),
      fee: fee.toFixed(),
      feeCurrency: currency,
      grossCurrency: currency,
      spreadCost: spread.mul(units).mul(quoteUsd.rate).toFixed(8),
      slippageCost: slippage.mul(units).mul(quoteUsd.rate).toFixed(8),
      quoteId: quote.quoteId,
      mark,
    };
  } catch (error) {
    return { accepted: false, reason: error instanceof Error ? error.message : 'INVALID_ORDER' };
  }
}
