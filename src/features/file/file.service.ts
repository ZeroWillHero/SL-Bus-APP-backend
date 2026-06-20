import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UploadApiResponse } from 'cloudinary';
import { cloudinary } from './cloudinary.provider';
import { FileUpload } from './entities/file-upload.entity';
import { FileEntityType } from './enums/file-entity-type.enum';
import { FileDocumentType } from './enums/file-document-type.enum';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { AppError } from '../../common/exceptions/app.exception';
import { User } from '../user/entity/user.entity';
import { Conductor } from '../conductor/entities/conductor.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { Bus } from '../bus/entities/bus.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const VALID_COMBINATIONS: Record<FileEntityType, FileDocumentType[]> = {
  [FileEntityType.USER]: [FileDocumentType.PROFILE_PICTURE],
  [FileEntityType.CONDUCTOR]: [FileDocumentType.CONDUCTOR_LICENSE],
  [FileEntityType.BUS_OWNER]: [FileDocumentType.NIC_DOCUMENT],
  [FileEntityType.BUS]: [
    FileDocumentType.RC,
    FileDocumentType.INSURANCE,
    FileDocumentType.FITNESS,
    FileDocumentType.OTHER,
  ],
};

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(FileUpload)
    private readonly fileRepo: Repository<FileUpload>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Conductor)
    private readonly conductorRepo: Repository<Conductor>,
    @InjectRepository(BusOwner)
    private readonly busOwnerRepo: Repository<BusOwner>,
    @InjectRepository(Bus)
    private readonly busRepo: Repository<Bus>,
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(
    caller: AuthenticatedUser,
    dto: UploadFileDto,
    multerFile: Express.Multer.File,
  ): Promise<FileUploadResponseDto> {
    // Non-admin users can only upload for themselves; derive userId from JWT
    if (
      dto.entityType === FileEntityType.USER &&
      !caller.roles.includes('Admin')
    ) {
      dto.entityId = caller.userId;
    }

    this.validateCombination(dto.entityType, dto.documentType);
    await this.resolveEntity(dto.entityType, dto.entityId);
    await this.checkPermission(
      caller,
      dto.entityType,
      dto.entityId,
      dto.documentType,
    );

    const cloudinaryResult = await this.uploadToCloudinary(
      multerFile.buffer,
      dto.entityType,
      dto.entityId,
      dto.documentType,
    );

    await this.fileRepo.update(
      {
        entityId: dto.entityId,
        documentType: dto.documentType,
        isActive: true,
      },
      { isActive: false },
    );

    const record = this.fileRepo.create({
      entityType: dto.entityType,
      entityId: dto.entityId,
      documentType: dto.documentType,
      filePath: cloudinaryResult.secure_url,
      originalName: multerFile.originalname,
      mimeType: multerFile.mimetype,
      sizeBytes: multerFile.size,
      uploadedByUserId: caller.userId,
      isActive: true,
      verifiedAt: null,
      verifiedByAdminId: null,
    });
    const saved = await this.fileRepo.save(record);

    await this.applySideEffect(
      dto.entityType,
      dto.entityId,
      dto.documentType,
      cloudinaryResult.secure_url,
    ).catch(() => undefined);

    return this.toResponseDto(saved);
  }

  async listHistory(
    caller: AuthenticatedUser,
    entityType: FileEntityType,
    entityId: string,
    documentType?: FileDocumentType,
  ): Promise<FileUploadResponseDto[]> {
    await this.checkPermission(
      caller,
      entityType,
      entityId,
      documentType ?? VALID_COMBINATIONS[entityType][0],
    );

    const where: Record<string, unknown> = { entityType, entityId };
    if (documentType) where.documentType = documentType;

    const records = await this.fileRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return records.map((r) => this.toResponseDto(r));
  }

  private uploadToCloudinary(
    buffer: Buffer,
    entityType: FileEntityType,
    entityId: string,
    documentType: FileDocumentType,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `sl-bus/${entityType}/${entityId}`,
          public_id: `${documentType}_${Date.now()}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new AppError(
                error?.message ?? 'Cloudinary upload failed',
                HttpStatus.INTERNAL_SERVER_ERROR,
              ),
            );
          } else {
            resolve(result);
          }
        },
      );
      stream.end(buffer);
    });
  }

  private validateCombination(
    entityType: FileEntityType,
    documentType: FileDocumentType,
  ) {
    const allowed = VALID_COMBINATIONS[entityType];
    if (!allowed.includes(documentType)) {
      throw new AppError(
        `documentType "${documentType}" is not valid for entityType "${entityType}"`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async resolveEntity(entityType: FileEntityType, entityId: string) {
    let found: unknown;
    switch (entityType) {
      case FileEntityType.USER:
        found = await this.userRepo.findOne({ where: { id: entityId } });
        break;
      case FileEntityType.CONDUCTOR:
        found = await this.conductorRepo.findOne({ where: { id: entityId } });
        break;
      case FileEntityType.BUS_OWNER:
        found = await this.busOwnerRepo.findOne({ where: { id: entityId } });
        break;
      case FileEntityType.BUS:
        found = await this.busRepo.findOne({ where: { id: entityId } });
        break;
    }
    if (!found) {
      throw new AppError(`${entityType} not found`, HttpStatus.NOT_FOUND);
    }
  }

  private async checkPermission(
    caller: AuthenticatedUser,
    entityType: FileEntityType,
    entityId: string,
    documentType: FileDocumentType,
  ) {
    if (caller.roles.includes('Admin')) return;

    if (
      entityType === FileEntityType.USER &&
      documentType === FileDocumentType.PROFILE_PICTURE
    ) {
      if (entityId !== caller.userId) {
        throw new AppError(
          'Cannot upload for another user',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }

    if (
      entityType === FileEntityType.CONDUCTOR &&
      documentType === FileDocumentType.CONDUCTOR_LICENSE
    ) {
      if (caller.roles.includes('Conductor')) {
        const c = await this.conductorRepo.findOne({
          where: { id: entityId },
          relations: ['user'],
        });
        if (c?.user?.id === caller.userId) return;
      }
      if (caller.roles.includes('BusOwner')) {
        const c = await this.conductorRepo.findOne({
          where: { id: entityId },
          relations: ['busOwner', 'busOwner.user'],
        });
        if (c?.busOwner?.user?.id === caller.userId) return;
      }
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN);
    }

    if (
      entityType === FileEntityType.BUS_OWNER &&
      documentType === FileDocumentType.NIC_DOCUMENT
    ) {
      if (!caller.roles.includes('BusOwner')) {
        throw new AppError('Forbidden', HttpStatus.FORBIDDEN);
      }
      const owner = await this.busOwnerRepo.findOne({
        where: { id: entityId },
        relations: ['user'],
      });
      if (owner?.user?.id !== caller.userId) {
        throw new AppError('Forbidden', HttpStatus.FORBIDDEN);
      }
      return;
    }

    if (entityType === FileEntityType.BUS) {
      if (!caller.roles.includes('BusOwner')) {
        throw new AppError('Forbidden', HttpStatus.FORBIDDEN);
      }
      const bus = await this.busRepo.findOne({
        where: { id: entityId },
        relations: ['owner', 'owner.user'],
      });
      if (bus?.owner?.user?.id !== caller.userId) {
        throw new AppError('Forbidden', HttpStatus.FORBIDDEN);
      }
      return;
    }

    throw new AppError('Forbidden', HttpStatus.FORBIDDEN);
  }

  private async applySideEffect(
    entityType: FileEntityType,
    entityId: string,
    documentType: FileDocumentType,
    secureUrl: string,
  ) {
    if (
      entityType === FileEntityType.USER &&
      documentType === FileDocumentType.PROFILE_PICTURE
    ) {
      await this.userRepo.update(entityId, { profilePicture: secureUrl });
    } else if (
      entityType === FileEntityType.CONDUCTOR &&
      documentType === FileDocumentType.CONDUCTOR_LICENSE
    ) {
      await this.conductorRepo.update(entityId, { licenseDoc: secureUrl });
    } else if (
      entityType === FileEntityType.BUS_OWNER &&
      documentType === FileDocumentType.NIC_DOCUMENT
    ) {
      await this.busOwnerRepo.update(entityId, { nicDocPath: secureUrl });
    }
  }

  private toResponseDto(record: FileUpload): FileUploadResponseDto {
    return {
      id: record.id,
      entityType: record.entityType,
      entityId: record.entityId,
      documentType: record.documentType,
      filePath: record.filePath,
      fileUrl: record.filePath,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      uploadedByUserId: record.uploadedByUserId,
      isActive: record.isActive,
      verifiedAt: record.verifiedAt,
      verifiedByAdminId: record.verifiedByAdminId,
      createdAt: record.createdAt,
    };
  }
}
