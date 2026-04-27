export class PaginationDTO {
  page!: number;
  limit!: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}
