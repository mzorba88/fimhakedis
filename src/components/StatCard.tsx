import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, className }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('stat-card', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-semibold tracking-tight text-foreground truncate">{value}</p>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-accent p-2 sm:p-2.5 text-accent-foreground shrink-0">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 sm:mt-4 flex items-center gap-2">
          <span className={cn(
            'text-[10px] sm:text-xs font-medium',
            trend.positive ? 'text-[hsl(var(--status-approved))]' : 'text-[hsl(var(--status-rejected))]'
          )}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </motion.div>
  );
}
