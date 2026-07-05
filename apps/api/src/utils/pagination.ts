export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export type PaginationResult = {
  page: number;
  pageSize: number;
  skip: number;
};

export function pagination(input: PaginationInput = {}, defaultPageSize = 25, maxPageSize = 100): PaginationResult {
  const pageSize = Math.min(Math.max(Number(input.pageSize) || defaultPageSize, 1), maxPageSize);
  const page = Math.max(Number(input.page) || 1, 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize))
  };
}

export function numberQueryParam(value: unknown) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (firstValue === undefined || firstValue === null || firstValue === "") return undefined;
  const parsed = Number(firstValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}
