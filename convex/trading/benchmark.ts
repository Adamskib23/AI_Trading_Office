import { INSTRUMENTS } from '../office/registry';
import { evaluate, FEES, initialAccount } from './engine';
import { D, cash, decimal } from './math';
import type { Account, Context, Proposal } from './types';
export type Benchmark = {
  account: Account;
  startedAt: number;
  legs: {
    instrumentId: string;
    filledAt?: number;
    quoteId?: string;
    quantity?: string;
    fee?: string;
    price?: string;
  }[];
};
export function initialBenchmark(now: number): Benchmark {
  return {
    account: initialAccount(now),
    startedAt: now,
    legs: ['us:SPY', 'fx:EUR/USD', 'kraken:BTC/USD', 'us:GLD'].map((instrumentId) => ({
      instrumentId,
    })),
  };
}
// Passive reference, not an employee: no six-trade limit or drawdown stop. Each sleeve
// spends at most $250 including the SAME execution spread, slippage and fee rules.
export function advanceBenchmark(before: Benchmark, ctx: Context): Benchmark {
  const state: Benchmark = {
    ...before,
    account: {
      ...before.account,
      cash: { ...before.account.cash },
      positions: { ...before.account.positions },
    },
    legs: before.legs.map((l) => ({ ...l })),
  };
  for (const leg of state.legs) {
    if (leg.filledAt) continue;
    const instrument = INSTRUMENTS.find((i) => i.id === leg.instrumentId)!;
    const quote = ctx.quotes[leg.instrumentId];
    if (!quote || quote.sourceTimestamp <= state.startedAt || quote.retrievedAt <= state.startedAt)
      continue;
    const fx = instrument.assetClass === 'fx';
    const probe: Proposal = {
      agentId: 'benchmark',
      cycleId: 'passive-reference',
      proposalIndex: 0,
      instrumentId: leg.instrumentId,
      action: fx ? 'CONVERT_CURRENCY' : 'BUY',
      ...(fx
        ? { fromCurrency: 'USD', toCurrency: 'EUR', amountFrom: '100' }
        : {
            quantity: new D(100)
              .div(quote.last)
              .toDecimalPlaces(instrument.quantityPrecision, D.ROUND_FLOOR)
              .toFixed(),
          }),
    };
    // Reuse all quote/calendar/entitlement/corporate-action checks on an empty probe account.
    const eligible = evaluate(initialAccount(ctx.now), probe, ctx);
    if (!eligible.accepted || !eligible.price) continue;
    const price = decimal(eligible.price),
      feeBps = FEES[instrument.assetClass].feeBps;
    const budget = new D('249.98'); // reserve two cents for conservative independent cash rounding
    let quantity: InstanceType<typeof D>,
      gross: InstanceType<typeof D>,
      fee: InstanceType<typeof D>;
    if (fx) {
      gross = new D(cash(budget.div(new D(1).add(new D(feeBps).div(10000))), 'USD', D.ROUND_FLOOR));
      fee = new D(cash(gross.mul(feeBps).div(10000), 'USD', D.ROUND_CEIL));
      quantity = new D(cash(gross.div(price), 'EUR', D.ROUND_FLOOR));
      state.account.cash.EUR = cash(decimal(state.account.cash.EUR).add(quantity), 'EUR');
    } else {
      quantity = budget
        .div(price.mul(new D(1).add(new D(feeBps).div(10000))))
        .toDecimalPlaces(instrument.quantityPrecision, D.ROUND_FLOOR);
      gross = new D(cash(quantity.mul(price), 'USD', D.ROUND_CEIL));
      fee = new D(cash(gross.mul(feeBps).div(10000), 'USD', D.ROUND_CEIL));
      state.account.positions[instrument.id] = quantity.toFixed(instrument.quantityPrecision);
    }
    if (gross.add(fee).gt(250) || decimal(state.account.cash.USD).lt(gross.add(fee)))
      throw new Error('BENCHMARK_BUDGET_ERROR');
    state.account.cash.USD = cash(decimal(state.account.cash.USD).sub(gross).sub(fee), 'USD');
    leg.filledAt = ctx.now;
    leg.quoteId = quote.quoteId;
    leg.quantity = quantity.toFixed();
    leg.fee = fee.toFixed();
    leg.price = price.toFixed();
  }
  return state;
}
