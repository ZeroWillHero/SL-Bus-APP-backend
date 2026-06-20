import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { FileService } from './file.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { FileEntityType } from './enums/file-entity-type.enum';
import { FileDocumentType } from './enums/file-document-type.enum';
import {
  multerFileFilter,
  multerLimits,
  multerMemoryStorage,
} from './multer.config';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('api/v1/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a file (multipart/form-data)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', enum: Object.values(FileEntityType) },
        entityId: { type: 'string', format: 'uuid' },
        documentType: { type: 'string', enum: Object.values(FileDocumentType) },
      },
      required: ['file', 'entityType', 'entityId', 'documentType'],
    },
  })
  @ApiCreatedResponse({ type: FileUploadResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerMemoryStorage,
      fileFilter: multerFileFilter,
      limits: multerLimits,
    }),
  )
  async upload(
    @Req() req: Request,
    @Body() dto: UploadFileDto,
    // typed as any to avoid emitDecoratorMetadata issues with Express.Multer.File namespace type
    @UploadedFile() file: any,
  ): Promise<FileUploadResponseDto> {
    const caller = req.user as AuthenticatedUser;
    return this.fileService.upload(caller, dto, file as Express.Multer.File);
  }

  @Get()
  @ApiOperation({ summary: 'List upload history for an entity' })
  @ApiQuery({ name: 'entityType', enum: FileEntityType })
  @ApiQuery({ name: 'entityId', type: String })
  @ApiQuery({ name: 'documentType', enum: FileDocumentType, required: false })
  @ApiOkResponse({ type: [FileUploadResponseDto] })
  async listHistory(
    @Req() req: Request,
    @Query('entityType') entityType: FileEntityType,
    @Query('entityId') entityId: string,
    @Query('documentType') documentType?: FileDocumentType,
  ): Promise<FileUploadResponseDto[]> {
    const caller = req.user as AuthenticatedUser;
    return this.fileService.listHistory(
      caller,
      entityType,
      entityId,
      documentType,
    );
  }
}
