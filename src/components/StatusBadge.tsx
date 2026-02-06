import { ApprovalStatus, PaymentStatus } from '@/types/hakedis';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ApprovalStatus | PaymentStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<ApprovalStatus | PaymentStatus, { label: string; className: string }> = {
  onay_bekliyor: { 
    label: 'Onay Bekliyor', 
    className: 'status-pending' 
  },
  onaylandi: { 
    label: 'Onaylandı', 
    className: 'status-approved' 
  },
  revize: { 
    label: 'Revize Gerekli', 
    className: 'status-rejected' 
  },
  odendi: { 
    label: 'Ödendi', 
    className: 'status-paid' 
  },
  odenmedi: { 
    label: 'Ödenmedi', 
    className: 'status-unpaid' 
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span 
      className={cn(
        'status-badge',
        config.className,
        size === 'sm' && 'text-[10px] px-2 py-0.5'
      )}
    >
      {config.label}
    </span>
  );
}
