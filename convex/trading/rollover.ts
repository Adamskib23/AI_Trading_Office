import { decimal } from './math';
import { utcDay } from './engine';
import type { Account, Mark } from './types';

type Witness = { at: number; priced: boolean; equityUsd: string | null };

// This is risk bookkeeping only: no balances, postings or funding change.
// Missing midnight evidence must not silently turn a later loss into a baseline.
export function rolloverDay(account: Account, mark: Mark, previous: Witness | null, now: number) {
  if (account.riskDay === utcDay(now)) return null;
  const midnight = Date.parse(`${utcDay(now)}T00:00:00Z`);
  if (
    !mark.priced ||
    !mark.equityUsd ||
    !previous?.priced ||
    !previous.equityUsd ||
    !Number.isFinite(previous.at) ||
    previous.at > now ||
    Math.abs(previous.at - midnight) > 300_000 ||
    account.riskDay !== utcDay(midnight - 1) ||
    !decimal(previous.equityUsd).gt(0) ||
    !decimal(mark.equityUsd).gt(0)
  )
    return null;
  return {
    riskDay: utcDay(now),
    filledToday: 0,
    dailyBaselineUsd: decimal(previous.equityUsd).gt(mark.equityUsd)
      ? previous.equityUsd
      : mark.equityUsd,
  };
}
