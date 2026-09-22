'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDirection } from '@/lib/useTableSort';

interface SortableThProps {
  label: React.ReactNode;
  sortKey: string;
  activeKey: string | null;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

/** Clickable <th> with a sort icon, for hand-rolled tables paired with useTableSort. */
export function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = 'px-4 py-2.5',
  align = 'left',
}: SortableThProps) {
  const isActive = activeKey === sortKey;
  return (
    <th className={className}>
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center space-x-1 hover:text-ey-light transition ${
          align === 'right' ? 'ml-auto flex-row-reverse space-x-reverse' : ''
        } ${isActive ? 'text-ey-yellow' : ''}`}
        title={`Sort by ${typeof label === 'string' ? label : sortKey}`}
      >
        <span>{label}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        )}
      </button>
    </th>
  );
}
