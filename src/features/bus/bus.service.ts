import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../common/exceptions/app.exception';
import { Bus } from './entities/bus.entity';
import { BusDocument } from './entities/bus-document.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { BusOwnerService } from '../bus-owner/bus-owner.service';
import { RouteService } from '../route/route.service';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { BusDto } from './dto/bus.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { BusDocumentDto } from './dto/bus-document.dto';
import { ApprovalStatus } from './enums/approval-status.enum';

@Injectable()
export class BusService {
  constructor(
    @InjectRepository(Bus)
    private readonly busRepo: Repository<Bus>,
    @InjectRepository(BusDocument)
    private readonly docRepo: Repository<BusDocument>,
    @InjectRepository(BusOwner)
    private readonly ownerRepo: Repository<BusOwner>,
    private readonly busOwnerService: BusOwnerService,
    private readonly routeService: RouteService,
  ) {}

  // ─── BusOwner operations ────────────────────────────────────────────────────

  async create(ownerId: string, dto: CreateBusDto): Promise<BusDto> {
    const owner = await this.ownerRepo.findOne({
      where: { id: ownerId },
      relations: ['user'],
    });
    if (!owner) throw new AppError('Bus owner not found', HttpStatus.NOT_FOUND);

    const existing = await this.busRepo.findOne({
      where: { registrationNumber: dto.registrationNumber },
    });
    if (existing) {
      throw new AppError(
        'Registration number already exists',
        HttpStatus.CONFLICT,
      );
    }

    const bus = this.busRepo.create({
      registrationNumber: dto.registrationNumber,
      model: dto.model,
      year: dto.year,
      totalSeats: dto.totalSeats,
      seatLayoutJson: dto.seatLayoutJson,
      approvalStatus: ApprovalStatus.PENDING,
      owner,
    });

    const saved = await this.busRepo.save(bus);
    return this.toDto(saved);
  }

  async findAllByOwner(
    ownerId: string,
    status?: ApprovalStatus,
  ): Promise<BusDto[]> {
    const where: Record<string, unknown> = { owner: { id: ownerId } };
    if (status) where.approvalStatus = status;
    const buses = await this.busRepo.find({ where, relations: ['owner', 'owner.user'] });
    return buses.map((b) => this.toDto(b));
  }

  async findOneByOwner(busId: string, ownerId: string): Promise<BusDto> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
      relations: ['owner', 'owner.user', 'routes', 'routes.bus'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);
    return this.toDto(bus);
  }

  async update(
    busId: string,
    ownerId: string,
    dto: UpdateBusDto,
  ): Promise<BusDto> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
      relations: ['owner', 'owner.user'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    if (bus.approvalStatus === ApprovalStatus.APPROVED) {
      throw new AppError(
        'Approved buses cannot be modified. Contact admin to re-review.',
        HttpStatus.FORBIDDEN,
      );
    }

    Object.assign(bus, {
      model: dto.model ?? bus.model,
      year: dto.year ?? bus.year,
      totalSeats: dto.totalSeats ?? bus.totalSeats,
      seatLayoutJson: dto.seatLayoutJson ?? bus.seatLayoutJson,
      approvalStatus: ApprovalStatus.PENDING,
    });

    await this.busRepo.save(bus);
    return this.toDto(bus);
  }

  // ─── Document operations ─────────────────────────────────────────────────────

  async uploadDocument(
    busId: string,
    ownerId: string,
    dto: UploadDocumentDto,
  ): Promise<BusDocumentDto> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    const doc = this.docRepo.create({
      bus,
      documentType: dto.documentType,
      fileData: dto.fileData,
    });

    const saved = await this.docRepo.save(doc);
    return this.toDocDto(saved, true);
  }

  async listDocuments(
    busId: string,
    ownerId: string,
  ): Promise<BusDocumentDto[]> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    const docs = await this.docRepo.find({ where: { bus: { id: busId } } });
    return docs.map((d) => this.toDocDto(d, false));
  }

  async getDocument(
    busId: string,
    ownerId: string,
    docId: string,
  ): Promise<BusDocumentDto> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    const doc = await this.docRepo.findOne({
      where: { id: docId, bus: { id: busId } },
    });
    if (!doc) throw new AppError('Document not found', HttpStatus.NOT_FOUND);
    return this.toDocDto(doc, true);
  }

  // ─── Admin operations ────────────────────────────────────────────────────────

  async findAll(status?: ApprovalStatus): Promise<BusDto[]> {
    const where = status ? { approvalStatus: status } : {};
    const buses = await this.busRepo.find({ where, relations: ['owner', 'owner.user'] });
    return buses.map((b) => this.toDto(b));
  }

  async findOneAdmin(busId: string): Promise<BusDto> {
    const bus = await this.busRepo.findOne({
      where: { id: busId },
      relations: ['owner', 'owner.user'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);
    return this.toDto(bus);
  }

  async approve(busId: string): Promise<BusDto> {
    const bus = await this.busRepo.findOne({
      where: { id: busId },
      relations: ['owner', 'owner.user'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    bus.approvalStatus = ApprovalStatus.APPROVED;
    bus.rejectionReason = null;
    await this.busRepo.save(bus);
    return this.toDto(bus);
  }

  async reject(busId: string, reason: string): Promise<BusDto> {
    if (!reason?.trim()) {
      throw new AppError(
        'Rejection reason is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const bus = await this.busRepo.findOne({
      where: { id: busId },
      relations: ['owner', 'owner.user'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    bus.approvalStatus = ApprovalStatus.REJECTED;
    bus.rejectionReason = reason.trim();
    await this.busRepo.save(bus);
    return this.toDto(bus);
  }

  async listDocumentsAdmin(busId: string): Promise<BusDocumentDto[]> {
    const bus = await this.busRepo.findOne({ where: { id: busId } });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);
    const docs = await this.docRepo.find({ where: { bus: { id: busId } } });
    return docs.map((d) => this.toDocDto(d, false));
  }

  // ─── Converters ──────────────────────────────────────────────────────────────

  toDto(bus: Bus): BusDto {
    return Object.assign(new BusDto(), {
      id: bus.id,
      registrationNumber: bus.registrationNumber,
      model: bus.model,
      year: bus.year,
      totalSeats: bus.totalSeats,
      seatLayoutJson: bus.seatLayoutJson,
      approvalStatus: bus.approvalStatus,
      rejectionReason: bus.rejectionReason,
      owner: bus.owner ? this.busOwnerService.convertToDto(bus.owner) : undefined,
      routes: bus.routes ? bus.routes.map((r) => this.routeService.toDto(r)) : undefined,
      createdAt: bus.createdAt,
      updatedAt: bus.updatedAt,
    });
  }

  private toDocDto(doc: BusDocument, includeFile: boolean): BusDocumentDto {
    return {
      id: doc.id,
      busId: (doc.bus as Bus | undefined)?.id ?? '',
      documentType: doc.documentType,
      fileData: includeFile ? doc.fileData : undefined,
      uploadedAt: doc.uploadedAt,
      verifiedAt: doc.verifiedAt,
      verifiedByAdminId: doc.verifiedByAdminId,
    };
  }
}
