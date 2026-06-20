import { ApiProperty } from '@nestjs/swagger';
import { FileEntityType } from '../enums/file-entity-type.enum';
import { FileDocumentType } from '../enums/file-document-type.enum';

export class FileUploadResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: FileEntityType })
  entityType!: FileEntityType;

  @ApiProperty()
  entityId!: string;

  @ApiProperty({ enum: FileDocumentType })
  documentType!: FileDocumentType;

  @ApiProperty()
  filePath!: string;

  @ApiProperty()
  fileUrl!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty()
  uploadedByUserId!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  verifiedAt!: Date | null;

  @ApiProperty({ nullable: true })
  verifiedByAdminId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
