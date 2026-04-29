'use client';

import React, { useState } from 'react';
import { SkeletonTable } from './Skeleton';
import EmptyState from './EmptyState';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey?: keyof T;
  onRowClick?: (item: T) => void;
  actions?: {
    label: string;
    onClick: (item: T) => void;
    icon?: React.ReactNode;
  }[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}

const DataTable = <T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  isEmpty = false,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no items to display.',
  rowKey = 'id' as keyof T,
  onRowClick,
  actions,
  pagination,
  search,
}: DataTableProps<T>) => {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  if (isLoading) {
    return <SkeletonTable rows={5} columns={columns.length} />;
  }

  if (isEmpty || data.length === 0) {
    return (
      <div className="card">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 13l-7 7-7-7m0 0V6m0 0h.01"
            />
          }
        />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {search && (
        <div
          className="px-6 py-4"
          style={{
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <input
            type="text"
            placeholder={search.placeholder || 'Search...'}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className="input-base"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  style={{ width: column.width }}
                  onClick={() =>
                    column.sortable && handleSort(column.key)
                  }
                  className={column.sortable ? 'cursor-pointer' : ''}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && (
                      <svg
                        className={`w-4 h-4 transition-transform ${
                          sortKey === column.key
                            ? sortOrder === 'desc'
                              ? 'rotate-180'
                              : ''
                            : 'opacity-50'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16V4m0 0L3 8m0 0l4 4m10-4v12m0 0l4-4m0 0l-4-4"
                        />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={String(item[rowKey] || index)}>
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    onClick={() => onRowClick?.(item)}
                    className={onRowClick ? 'cursor-pointer' : ''}
                  >
                    {column.render
                      ? column.render(item[column.key], item)
                      : String(item[column.key])}
                  </td>
                ))}
                {actions && (
                  <td>
                    <div className="flex gap-2">
                      {actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => action.onClick(item)}
                          className="transition-colors duration-200 p-1"
                          style={{ color: 'var(--color-text-secondary)' }}
                          title={action.label}
                        >
                          {action.icon || action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Page {pagination.currentPage} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                pagination.onPageChange(pagination.currentPage - 1)
              }
              disabled={pagination.currentPage === 1}
              className="px-3 py-2 text-sm font-medium transition-colors duration-200"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                opacity: pagination.currentPage === 1 ? 0.5 : 1,
                cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <button
              onClick={() =>
                pagination.onPageChange(pagination.currentPage + 1)
              }
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-2 text-sm font-medium transition-colors duration-200"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1,
                cursor: pagination.currentPage === pagination.totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
