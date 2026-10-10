import { formatCurrencyWithType, type Currency } from '@/types/hakedis';

/** Para birimi bazında tutar haritası. Farklı para birimleri ASLA toplanmaz. */
export type CurrencyTotals = Partial<Record<Currency, number>>;

const ORDER: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];

export function sumByCurrency<T>(
  items: T[],
  getAmount: (item: T) => number,
  getCurrency: (item: T) => string | undefined | null
): CurrencyTotals {
  const out: CurrencyTotals = {};
  items.forEach((it) => {
    const cur = ((getCurrency(it) || 'TRY') as Currency);
    out[cur] = (out[cur] || 0) + (getAmount(it) || 0);
  });
  return out;
}

export function subtractTotals(a: CurrencyTotals, b: CurrencyTotals): CurrencyTotals {
  const out: CurrencyTotals = { ...a };
  (Object.keys(b) as Currency[]).forEach((c) => {
    out[c] = (out[c] || 0) - (b[c] || 0);
  });
  return out;
}

/** Sıfır olmayan para birimlerini sabit sırayla döndürür. */
export function currencyEntries(t: CurrencyTotals): [Currency, number][] {
  return ORDER.filter((c) => Math.abs(t[c] || 0) > 0.0049).map((c) => [c, t[c] || 0]);
}

/** "₺1.000,00 · £500,00" biçiminde; hiç tutar yoksa ₺0,00 */
export function formatCurrencyTotals(t: CurrencyTotals, separator = ' · '): string {
  const e = currencyEntries(t);
  if (e.length === 0) return formatCurrencyWithType(0, 'TRY');
  return e.map(([c, v]) => formatCurrencyWithType(v, c)).join(separator);
}
