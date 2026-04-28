import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Bus } from './bus.entity';
import { DocumentType } from '../enums/document-type.enum';

@Entity()
export class BusDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Bus, (bus) => bus.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'busId' })
  bus!: Bus;

  @Column({ type: 'enum', enum: DocumentType })
  documentType!: DocumentType;

  @Column({ type: 'text' })
  fileData!: string;

  @CreateDateColumn()
  uploadedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedByAdminId!: string | null;
}
