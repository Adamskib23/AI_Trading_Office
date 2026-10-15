// Synthetic unit-test context only. No market-feed integration imports this module.
import { INSTRUMENTS } from '../office/registry';
import type { Context } from './types';
export const NOW = Date.parse('2026-10-15T14:00:00Z');
export function fixtureContext(now = NOW): Context {
  const quotes: Context['quotes'] = {},
    capabilities: Context['capabilities'] = {};
  const prices: Record<string, string> = {
    'EUR/USD': '1.10',
    'GBP/USD': '1.25',
    'USD/JPY': '150',
    'BTC/USD': '50000',
    'ETH/USD': '2000',
    'SOL/USD': '100',
  };
  for (const i of INSTRUMENTS) {
    quotes[i.id] = {
      quoteId: `test:${i.id}`,
      instrumentId: i.id,
      provider: 'fixture',
      venue: i.venue,
      currency: i.quoteCurrency,
      sourceTimestamp: now - 1000,
      retrievedAt: now - 500,
      last: prices[i.symbol] ?? '100',
      healthy: true,
      sourceMode: 'fixture',
      delayMs: 0,
    };
    capabilities[i.id] = {
      instrumentId: i.id,
      provider: 'fixture',
      quoteVerified: true,
      candlesVerified: true,
      rightsVerified: true,
      sessionVerified: true,
      corporateActionsClearUntil: now + 86400_000,
      sourceMode: 'fixture',
    };
  }
  return {
    now,
    quotes,
    capabilities,
    selected: INSTRUMENTS.map((i) => i.id),
    mode: 'FIXTURE',
    globalPaused: false,
  };
}
