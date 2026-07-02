import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn, sortNatural } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Project } from '@/types/hakedis';

interface ProjectComboboxProps {
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  className?: string;
}

export function ProjectCombobox({
  projects,
  value,
  onChange,
  includeAll = false,
  allLabel = 'Tüm Projeler',
  placeholder = 'Proje seçin',
  className,
}: ProjectComboboxProps) {
  const [open, setOpen] = useState(false);
  const sorted = sortNatural(projects, (p) => p.projectCode);

  const selectedLabel =
    value === 'all'
      ? allLabel
      : (() => {
          const p = projects.find((x) => x.id === value);
          return p ? `${p.projectCode} - ${p.projectName}` : placeholder;
        })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => {
            if (val.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput placeholder="Proje ara..." />
          <CommandList>
            <CommandEmpty>Proje bulunamadı.</CommandEmpty>
            <CommandGroup>
              {includeAll && (
                <CommandItem
                  value={allLabel}
                  onSelect={() => {
                    onChange('all');
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === 'all' ? 'opacity-100' : 'opacity-0')} />
                  {allLabel}
                </CommandItem>
              )}
              {sorted.map((p) => {
                const label = `${p.projectCode} - ${p.projectName}`;
                return (
                  <CommandItem
                    key={p.id}
                    value={label}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
