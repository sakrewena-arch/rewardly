// Pagination utility for Supabase queries

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Calcule les paramètres de pagination pour Supabase
 */
export function getPaginationRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

/**
 * Construit un résultat paginé
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Hook de pagination côté client
 */
export function getPageFromSearchParams(searchParams: URLSearchParams, defaultPageSize = 20) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || String(defaultPageSize), 10) || defaultPageSize)
  );
  return { page, pageSize };
}