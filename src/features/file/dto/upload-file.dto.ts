import { ApiProperty } from '@nestjs/swagger';
import { FileEntityType } from '../enums/file-entity-type.enum';
import { FileDocumentType } from '../enums/file-document-type.enum';

export class UploadFileDto {
  @ApiProperty({ enum: FileEntityType })
  entityType!: FileEntityType;

  @ApiProperty({ description: 'UUID of the target entity' })
  entityId!: string;

  @ApiProperty({ enum: FileDocumentType })
  documentType!: FileDocumentType;
}
