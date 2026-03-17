import { formatCurrencyWithType, Currency } from '@/types/hakedis';

interface AmountCellProps {
  totalAmount: number; // KDV hariç tutar
  vatRate?: number | null;
  currency: Currency;
  className?: string;
}

/**
 * Displays KDV hariç, KDV tutarı, and KDV dahil in a single stacked cell.
 * Used across all tables for consistent financial display.
 */
export function AmountCell({ totalAmount, vatRate, currency, className = '' }: AmountCellProps) {
  const vr = vatRate && vatRate > 0 ? vatRate : 0;
  const vatAmount = totalAmount * (vr / 100);
  const totalWithVat = totalAmount + vatAmount;

  if (vr === 0) {
    return (
      <div className={className}>
        <p className="text-sm font-semibold text-foreground">
          {formatCurrencyWithType(totalAmount, currency)}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-0.5 ${className}`}>
      <p className="text-sm font-semibold text-foreground">
        {formatCurrencyWithType(totalWithVat, currency)}
      </p>
      <p className="text-[11px] text-muted-foreground leading-tight">
        KDV Hariç: {formatCurrencyWithType(totalAmount, currency)}
      </p>
      <p className="text-[11px] text-muted-foreground leading-tight">
        KDV (%{vr}): {formatCurrencyWithType(vatAmount, currency)}
      </p>
    </div>
  );
}
