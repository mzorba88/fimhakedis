import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubcontractorHakedis } from '@/types/hakedis';

export const isHakedisUrgent = (h?: Pick<SubcontractorHakedis, 'isUrgent' | 'paymentStatus'> | null) =>
  !!h?.isUrgent && h.paymentStatus !== 'odendi';

interface UrgentBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function UrgentBadge({ className, size = 'md' }: UrgentBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-destructive bg-destructive/10 font-semibold uppercase tracking-wide text-destructive',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        className,
      )}
    >
      <AlertTriangle className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      ACİL
    </span>
  );
}
