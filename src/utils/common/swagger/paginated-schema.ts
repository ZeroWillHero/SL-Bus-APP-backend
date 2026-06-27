import { getSchemaPath } from '@nestjs/swagger';

/**
 * Generates an @ApiOkResponse schema for a paginated endpoint.
 * Usage:
 *   @ApiExtraModels(BusDto)
 *   @ApiOkResponse({ schema: paginatedSchema(BusDto) })
 */
export function paginatedSchema(dtoRef: new (...args: never[]) => unknown) {
  return {
    properties: {
      items: {
        type: 'array',
        items: { $ref: getSchemaPath(dtoRef) },
      },
      total: { type: 'number', example: 100 },
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      pages: { type: 'number', example: 5 },
      nextPage: { type: 'number', example: 2, nullable: true },
      prevPage: { type: 'number', nullable: true },
    },
  };
}
