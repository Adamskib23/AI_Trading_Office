export type AssetClass = 'stock' | 'etf' | 'fx' | 'crypto';
export type CalendarId = 'us-equity' | 'fx-reference' | 'crypto';
export interface Instrument {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  exposure: string;
  venue: string;
  baseCurrency: string;
  quoteCurrency: string;
  calendarId: CalendarId;
  quantityPrecision: number;
  fractionalAllowed: boolean;
}
const security = (
  symbol: string,
  assetClass: 'stock' | 'etf',
  venue: string,
  exposure = 'equity',
): Instrument => ({
  id: `us:${symbol}`,
  symbol,
  assetClass,
  exposure,
  venue,
  baseCurrency: symbol,
  quoteCurrency: 'USD',
  calendarId: 'us-equity',
  // Explicit paper-only fractional-share assumption; not a broker capability claim.
  quantityPrecision: 6,
  fractionalAllowed: true,
});
export const INSTRUMENTS: Instrument[] = [
  ...['AAPL', 'MSFT', 'NVDA'].map((s) => security(s, 'stock', 'NASDAQ')),
  security('SPY', 'etf', 'NYSE_ARCA'),
  security('QQQ', 'etf', 'NASDAQ'),
  ...['GLD', 'SLV', 'USO'].map((s) => security(s, 'etf', 'NYSE_ARCA', 'commodity_proxy')),
  ...['EUR/USD', 'GBP/USD', 'USD/JPY'].map((symbol) => ({
    id: `fx:${symbol}`,
    symbol,
    assetClass: 'fx' as const,
    exposure: 'cash_conversion',
    venue: 'OTC_REFERENCE',
    baseCurrency: symbol.split('/')[0],
    quoteCurrency: symbol.split('/')[1],
    calendarId: 'fx-reference' as const,
    quantityPrecision: 2,
    fractionalAllowed: true,
  })),
  ...['BTC', 'ETH', 'SOL'].map((baseCurrency) => ({
    id: `kraken:${baseCurrency}/USD`,
    symbol: `${baseCurrency}/USD`,
    assetClass: 'crypto' as const,
    exposure: 'spot',
    venue: 'KRAKEN',
    baseCurrency,
    quoteCurrency: 'USD',
    calendarId: 'crypto' as const,
    quantityPrecision: 8,
    fractionalAllowed: true,
  })),
];
