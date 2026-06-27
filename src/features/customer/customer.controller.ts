import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerFilterDto } from './dto/customer-filter.dto';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { PageResponseDTO } from '../../utils/common/dto/pageResponse.dto';
import { parsePage, parseLimit } from '../../utils/common/dto/pagination.dto';
import { paginatedSchema } from '../../utils/common/swagger/paginated-schema';
import { CustomerDTO } from './dto/customer.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiExtraModels(CustomerDTO)
@Controller('api/v1/customer')
@ApiTags('Customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
  ): Promise<ResponseDTO<CustomerDTO>> {
    const result = await this.customerService.create(createCustomerDto);
    return new ResponseDTO<CustomerDTO>(
      true,
      'Customer created successfully',
      result,
    );
  }

  @Get()
  @Roles('Admin')
  @ApiOperation({
    summary:
      'List all customers with pagination and search filters (Admin only)',
  })
  @ApiOkResponse({ schema: paginatedSchema(CustomerDTO) })
  async findAll(
    @Query() filters: CustomerFilterDto,
  ): Promise<ResponseDTO<PageResponseDTO<CustomerDTO>>> {
    const page = parsePage(filters.page);
    const limit = parseLimit(filters.limit);
    const { items, total } = await this.customerService.findAll(filters);
    return new ResponseDTO(
      true,
      'Customers fetched successfully',
      new PageResponseDTO(items, total, page, limit),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by id' })
  @ApiResponse({ status: 200, description: 'Customer fetched successfully' })
  async findOne(@Param('id') id: string): Promise<ResponseDTO<CustomerDTO>> {
    const result = await this.customerService.findOne(id);
    return new ResponseDTO<CustomerDTO>(
      true,
      'Customer fetched successfully',
      result,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer by id' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ): Promise<ResponseDTO<CustomerDTO>> {
    const result = await this.customerService.update(id, updateCustomerDto);
    return new ResponseDTO<CustomerDTO>(
      true,
      'Customer updated successfully',
      result,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete customer by id' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  async remove(@Param('id') id: string): Promise<ResponseDTO<null>> {
    await this.customerService.remove(id);
    return new ResponseDTO<null>(true, 'Customer deleted successfully', null);
  }
}
