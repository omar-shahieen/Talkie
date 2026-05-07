export class PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    isFirst: boolean;
    isLast: boolean;
    isEmpty: boolean;
  };

  constructor(data: T[], total: number, page: number = 1, limit: number = 10) {
    const totalPages = Math.ceil(total / limit);
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      isFirst: page == 1,
      isLast: page == totalPages,
      isEmpty: page > totalPages,
    };
  }
}
