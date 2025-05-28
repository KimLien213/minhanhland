import { Between, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from './pagination.dto';
import { PaginationResult } from './pagination.interface';

export async function paginate<T>(
  query: SelectQueryBuilder<T>,
  dto: PaginationDto,
  searchableFields: string[] = [],
  dateField: keyof T = 'createdAt' as keyof T,
): Promise<PaginationResult<T>> {
  const { page = 1, limit = 10, search, sortBy, sortOrder, fromDate, toDate, status } = dto;

  if (search && searchableFields.length) {
    searchableFields.forEach((field, i) => {
      const condition = `LOWER(${String(field)}) LIKE LOWER(:search)`;
      if (i === 0) query.where(condition, { search: `%${search}%` });
      else query.orWhere(condition, { search: `%${search}%` });
    });
  }

  if (fromDate && toDate) {
    query.andWhere(`${query.alias}.${String(dateField)} BETWEEN :fromDate AND :toDate`, {
      fromDate,
      toDate,
    });
  }

  if (status) {
    query.andWhere(`${query.alias}.status = :status`, { status });
  }

  if (sortBy) {
    query.orderBy(`${query.alias}.${sortBy}`, sortOrder ?? 'DESC');
  }

  const [data, total] = await query
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return {
    data,
    meta: {
      page,
      limit,
      total,
    },
  };
}
