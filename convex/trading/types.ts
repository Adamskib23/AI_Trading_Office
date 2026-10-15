import type { Instrument } from '../office/registry';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY';
export type Quote = {
  quoteId: string;
  instrumentId: string;
  provider: string;
  venue: string;
  currency: string;
  sourceTimestamp: number;
  retrievedAt: number;
  last: string;
  bid?: string;
  ask?: string;
  sourceMode: 'live' | 'delayed' | 'indicative' | 'fixture';
  delayMs: number;
  healthy: boolean;
};
export type Candle = {
  instrumentId: string;
  provider: string;
  start: number;
  end: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
  adjustment: 'raw';
};
export type Capability = {
  instrumentId: string;
  provider: string;
  quoteVerified: boolean;
  candlesVerified: boolean;
  rightsVerified: boolean;
  sessionVerified: boolean;
  corporateActionsClearUntil: number;
  sourceMode: Quote['sourceMode'];
};
export type Account = {
  cash: Record<Currency, string>;
  positions: Record<string, string>;
  initialUsd: string;
  dailyBaselineUsd: string;
  riskDay: string;
  filledToday: number;
  paused: boolean;
};
export type Proposal = {
  agentId: string;
  cycleId: string;
  proposalIndex: number;
  instrumentId: string;
  action: 'BUY' | 'SELL' | 'CONVERT_CURRENCY';
  quantity?: string;
  amountFrom?: string;
  fromCurrency?: Currency;
  toCurrency?: Currency;
};
export type Posting = {
  asset: string;
  account: 'agent' | 'clearing' | 'fees' | 'funding';
  delta: string;
};
export type Mark = {
  equityUsd: string | null;
  priced: boolean;
  components: {
    asset: string;
    quantity: string;
    valueUsd: string | null;
    sourceTimestamp: number | null;
    status: 'CASH' | 'FRESH' | 'CLOSED_LAST_MARK' | 'MISSING_OR_STALE';
  }[];
  exposure: Record<string, string>;
  classExposure: Record<string, string>;
};
export type Context = {
  now: number;
  quotes: Record<string, Quote>;
  capabilities: Record<string, Capability>;
  selected: string[];
  mode: 'FIXTURE' | 'PROVIDER';
  globalPaused: boolean;
};
export type Execution = {
  accepted: boolean;
  reason: string;
  account?: Account;
  postings?: Posting[];
  price?: string;
  quantity?: string;
  gross?: string;
  fee?: string;
  spreadCost?: string;
  slippageCost?: string;
  quoteId?: string;
  feeCurrency?: string;
  grossCurrency?: string;
  mark?: Mark;
};
export interface MarketDataProvider {
  getQuote(instrument: Instrument): Promise<Quote>;
  getClosedCandles(instrument: Instrument, now: number): Promise<Candle[]>;
  health(): Promise<boolean>;
}
