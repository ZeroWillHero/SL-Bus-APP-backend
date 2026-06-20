import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FileEntityType } from '../enums/file-entity-type.enum';
import { FileDocumentType } from '../enums/file-document-type.enum';

@Entity('file_upload')
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  entityType!: FileEntityType;

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({ type: 'varchar' })
  documentType!: FileDocumentType;

  @Column({ type: 'varchar' })
  filePath!: string;

  @Column({ type: 'varchar' })
  originalName!: string;

  @Column({ type: 'varchar' })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'uuid' })
  uploadedByUserId!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedByAdminId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
