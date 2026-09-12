'use client';

import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

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
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getValue = (row: T, col: Column<T>) => {
    if (typeof col.accessorKey === 'function') {
      return col.accessorKey(row);
    }
    return row[col.accessorKey];
  };

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
              {columns.map((col, idx) => (
                <th key={idx} className="px-4 py-3">
                  <div className="flex items-center space-x-1">
                    <span>{col.header}</span>
                  </div>
                </th>
              ))}
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
