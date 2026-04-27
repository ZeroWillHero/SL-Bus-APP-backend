import { PaginationDTO } from '../../../utils/common/dto/pagination.dto';

export class UserFiltersDTO extends PaginationDTO {
  search?: string;
  email?: string;
  phone?: string;
}
