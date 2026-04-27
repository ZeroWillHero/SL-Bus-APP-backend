class PageResponseDTO<T> {
  data!: T[];
  total!: number;
  page!: number;
  limit!: number;
  nextPage?: number;
  prevPage?: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.nextPage = page * limit < total ? page + 1 : undefined;
    this.prevPage = page > 1 ? page - 1 : undefined;
  }
}
