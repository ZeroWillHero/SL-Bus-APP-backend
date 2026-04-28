import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchPageDto } from './dto/search-result.dto';
import { ResponseDTO } from '../../utils/common/dto/response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Search')
@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('buses')
  @Public()
  @ApiOperation({
    summary: 'Search available buses by origin, destination and date',
  })
  @ApiQuery({ name: 'origin', required: true })
  @ApiQuery({ name: 'destination', required: true })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['time_asc', 'fare_asc', 'fare_desc'],
  })
  @ApiOkResponse({ type: SearchPageDto })
  async search(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('date') date: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sort') sort = 'time_asc',
  ): Promise<ResponseDTO<SearchPageDto>> {
    const result = await this.searchService.findBuses(
      origin,
      destination,
      date,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, parseInt(limit, 10) || 20),
      sort,
    );
    return new ResponseDTO(true, 'Search results fetched successfully', result);
  }
}
