import Decimal from 'decimal.js';
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export function decimal(value: string) {
  if (value.length > 80 || !/^-?\d+(\.\d+)?$/.test(value)) throw new Error('INVALID_DECIMAL');
  const result = new D(value);
  if (!result.isFinite()) throw new Error('INVALID_DECIMAL');
  return result;
}
export const cashPrecision = (currency: string) => (currency === 'JPY' ? 0 : 2);
export const cash = (
  value: Decimal.Value,
  currency: string,
  rounding: Decimal.Rounding = Decimal.ROUND_HALF_EVEN,
) =>
  new D(value).toDecimalPlaces(cashPrecision(currency), rounding).toFixed(cashPrecision(currency));
export function positive(value: string | undefined, precision: number) {
  if (value === undefined) throw new Error('INVALID_QUANTITY');
  const result = decimal(value);
  if (!result.gt(0) || result.decimalPlaces() > precision) throw new Error('INVALID_QUANTITY');
  return result;
}
