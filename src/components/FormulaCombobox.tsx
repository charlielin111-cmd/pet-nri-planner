import React, { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Formula } from '@/lib/types';

interface FormulaComboboxProps {
  formulas: Formula[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export const FormulaCombobox: React.FC<FormulaComboboxProps> = ({
  formulas,
  value,
  onChange,
  placeholder = '選擇配方',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const selected = formulas.find(f => f.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between font-normal', className)}
        >
          <span className="truncate">
            {selected ? `${selected.code} - ${selected.name}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.toLowerCase();
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="搜尋配方編號或名稱..." />
          <CommandList>
            <CommandEmpty>找不到符合的配方</CommandEmpty>
            <CommandGroup>
              {formulas.map(f => (
                <CommandItem
                  key={f.id}
                  value={`${f.code} ${f.name}`}
                  onSelect={() => {
                    onChange(f.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === f.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="font-mono text-xs text-muted-foreground mr-2">{f.code}</span>
                  <span>{f.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
