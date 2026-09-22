'use client';

import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => any);
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  title,
  data,
  columns,
  pageSize = 10,
  onRowClick,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  // Sort is tracked by column index (not accessorKey) since accessorKey may
  // be a derived function rather than a stable, unique field name.
  const [sortColIdx, setSortColIdx] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const getValue = (row: T, col: Column<T>) => {
    if (typeof col.accessorKey === 'function') {
      return col.accessorKey(row);
    }
    return row[col.accessorKey];
  };

  // Search filter logic
  const filteredData = data.filter((row) =>
    Object.values(row).some((val) => {
      if (val === null || val === undefined || React.isValidElement(val)) return false;
      if (typeof val === 'string' || typeof val === 'number') {
        return String(val).toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    })
  );

  // Sort logic — applied after search, before pagination, so page numbers
  // stay meaningful against the sorted order.
  const sortedData = (() => {
    if (sortColIdx === null) return filteredData;
    const col = columns[sortColIdx];
    if (!col) return filteredData;
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      const va = getValue(a, col);
      const vb = getValue(b, col);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
  })();

  const handleSort = (idx: number) => {
    if (sortColIdx === idx) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColIdx(idx);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const renderCell = (row: T, col: Column<T>) => {
    if (col.cell) {
      return col.cell(row);
    }
    const val = getValue(row, col);
    if (React.isValidElement(val)) {
      return val;
    }
    return String(val ?? '-');
  };

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
      {/* Table Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-ey-light">{title}</h3>
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ey-muted" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md pl-9 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-ey-light">
          <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border">
            <tr>
              {columns.map((col, idx) => {
                const sortable = col.sortable !== false;
                const isActive = sortColIdx === idx;
                return (
                  <th key={idx} className="px-4 py-3">
                    {sortable ? (
                      <button
                        onClick={() => handleSort(idx)}
                        className={`flex items-center space-x-1 hover:text-ey-light transition ${isActive ? 'text-ey-yellow' : ''}`}
                        title={`Sort by ${col.header}`}
                      >
                        <span>{col.header}</span>
                        {isActive ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center space-x-1">
                        <span>{col.header}</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-ey-border">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-ey-card-hover/80 transition ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="px-4 py-3 font-medium text-ey-light">
                      {renderCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-ey-muted">
                  No matching records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 pt-3 border-t border-ey-border flex items-center justify-between text-xs text-ey-muted">
        <div>
          Showing {filteredData.length ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
        </div>

        <div className="flex items-center space-x-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="p-1 rounded bg-ey-black border border-ey-border text-ey-light hover:bg-ey-card-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="p-1 rounded bg-ey-black border border-ey-border text-ey-light hover:bg-ey-card-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
