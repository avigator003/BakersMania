"use client";

import { useEffect, useMemo, useState } from "react";

const pageSizeOptions = [10, 25, 50, 100];

export function usePagination<T>(items: T[], initialPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    pageCount,
    pageItems,
    pageSize,
    setPage,
    setPageSize,
    total: items.length
  };
}

export function PaginationControls({
  page,
  pageCount,
  pageSize,
  setPage,
  setPageSize,
  summary,
  total
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  summary?: Array<{ label: string; value: string | number }>;
  total: number;
}) {
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="sticky top-14 z-10 flex flex-col gap-3 border-b border-line bg-panel/95 px-4 py-3 text-sm text-muted backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          Showing <span className="font-semibold text-ink">{start}-{end}</span> of <span className="font-semibold text-ink">{total}</span>
        </span>
        {summary?.map((item) => (
          <span key={item.label} className="whitespace-nowrap">
            {item.label}: <span className="font-semibold text-ink">{item.value}</span>
          </span>
        ))}
        <label className="inline-flex items-center gap-2">
          <span>Rows</span>
          <select
            className="focus-ring rounded-md border border-line bg-panel2 px-2 py-1 text-ink"
            onChange={(event) => setPageSize(Number(event.target.value))}
            value={pageSize}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="focus-ring rounded-md border border-line bg-panel2 px-3 py-1.5 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          type="button"
        >
          Previous
        </button>
        <span className="min-w-20 text-center">
          Page <span className="font-semibold text-ink">{page}</span> / {pageCount}
        </span>
        <button
          className="focus-ring rounded-md border border-line bg-panel2 px-3 py-1.5 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
