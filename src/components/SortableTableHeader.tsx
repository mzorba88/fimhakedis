import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function SortableTableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
  align = 'left'
}: SortableTableHeaderProps) {
  const isActive = currentSort.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  }[align];

  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors select-none',
        alignClass,
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className={cn(
        'flex items-center gap-1.5',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center'
      )}>
        <span>{label}</span>
        <span className="flex-shrink-0">
          {direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : direction === 'desc' ? (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </span>
      </div>
    </th>
  );
}

export function useSorting(defaultSort: SortConfig = { key: '', direction: null }) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSort);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      if (current.direction === 'desc') {
        return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  return { sortConfig, handleSort };
}
