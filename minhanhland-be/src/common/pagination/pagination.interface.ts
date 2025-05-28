export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMeta;
}
