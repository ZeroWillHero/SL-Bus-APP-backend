import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../enums/document-type.enum';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType, example: DocumentType.RC })
  documentType!: DocumentType;

  @ApiProperty({ description: 'Base64-encoded file content' })
  fileData!: string;
}
