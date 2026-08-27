import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn, sortNatural, matchesSearch } from '@/lib/utils';
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

interface SubcontractorComboboxProps {
  names: string[];
  value: string;
  /** isNew is true when the user typed a name that is not in the list */
  onChange: (value: string, isNew: boolean) => void;
  placeholder?: string;
  className?: string;
}

export function SubcontractorCombobox({
  names,
  value,
  onChange,
  placeholder = 'Altyüklenici seçin veya yazın',
  className,
}: SubcontractorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const sorted = sortNatural(names, (n) => n);
  const filtered = query.trim() ? sorted.filter((n) => matchesSearch(n, query)) : sorted;
  const trimmed = query.trim();
  const canCreate =
    trimmed.length > 0 && !names.some((n) => n.toLocaleLowerCase('tr') === trimmed.toLocaleLowerCase('tr'));

  const select = (name: string, isNew: boolean) => {
    onChange(name, isNew);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Altyüklenici ara veya yeni ad yazın..." value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[45vh]">
            {!canCreate && <CommandEmpty>Altyüklenici bulunamadı.</CommandEmpty>}
            {canCreate && (
              <CommandGroup>
                <CommandItem value={`__new__${trimmed}`} onSelect={() => select(trimmed, true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Yeni ekle: “{trimmed}”
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((n) => (
                  <CommandItem key={n} value={n} onSelect={() => select(n, false)}>
                    <Check className={cn('mr-2 h-4 w-4', value === n ? 'opacity-100' : 'opacity-0')} />
                    {n}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
