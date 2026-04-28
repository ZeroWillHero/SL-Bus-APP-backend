import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../enums/document-type.enum';

export class BusDocumentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  busId!: string;

  @ApiProperty({ enum: DocumentType })
  documentType!: DocumentType;

  @ApiProperty({
    required: false,
    description: 'Included only on single-document fetch',
  })
  fileData?: string;

  @ApiProperty()
  uploadedAt!: Date;

  @ApiProperty({ nullable: true })
  verifiedAt!: Date | null;

  @ApiProperty({ nullable: true })
  verifiedByAdminId!: string | null;
}
