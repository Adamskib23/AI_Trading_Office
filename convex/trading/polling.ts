import { INSTRUMENTS } from '../office/registry';
import { marketState } from '../office/calendar';
import { decimal } from './math';
import type { Account } from './types';

export function midnightWindow(now: number) {
  const dayMs = ((now % 86400_000) + 86400_000) % 86400_000;
  return dayMs >= 86400_000 - 120_000 || dayMs < 360_000;
}

export function midnightInstruments(accounts: Pick<Account, 'cash' | 'positions'>[], now: number) {
  if (!midnightWindow(now)) return [];
  const needed = new Set<string>();
  for (const account of accounts) {
    for (const [id, quantity] of Object.entries(account.positions))
      if (decimal(quantity).gt(0)) needed.add(id);
    for (const currency of ['EUR', 'GBP', 'JPY'] as const)
      if (decimal(account.cash[currency]).gt(0))
        needed.add(currency === 'JPY' ? 'fx:USD/JPY' : `fx:${currency}/USD`);
  }
  return INSTRUMENTS.filter(
    (instrument) =>
      needed.has(instrument.id) && marketState(instrument.calendarId, now).state !== 'CLOSED',
  ).map((instrument) => instrument.id);
}
