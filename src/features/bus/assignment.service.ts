import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusAssignment } from './entities/bus-assignment.entity';
import { Bus } from './entities/bus.entity';
import { Conductor } from '../conductor/entities/conductor.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { BusAssignmentDto } from './dto/bus-assignment.dto';
import { BusDto } from './dto/bus.dto';
import { ApprovalStatus } from './enums/approval-status.enum';

@Injectable()
export class AssignmentService {
  constructor(
    @InjectRepository(BusAssignment)
    private readonly assignmentRepo: Repository<BusAssignment>,
    @InjectRepository(Bus)
    private readonly busRepo: Repository<Bus>,
    @InjectRepository(Conductor)
    private readonly conductorRepo: Repository<Conductor>,
  ) {}

  async assign(
    busId: string,
    conductorId: string,
    ownerId: string,
  ): Promise<BusAssignmentDto> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);
    if (bus.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new AppError(
        'Only approved buses can have conductors assigned',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const conductor = await this.conductorRepo.findOne({
      where: { id: conductorId },
    });
    if (!conductor)
      throw new AppError('Conductor not found', HttpStatus.NOT_FOUND);

    const existing = await this.assignmentRepo.findOne({
      where: { bus: { id: busId }, conductor: { id: conductorId } },
      relations: ['bus', 'conductor'],
    });

    if (existing) {
      if (existing.isActive) {
        throw new AppError(
          'Conductor is already assigned to this bus',
          HttpStatus.CONFLICT,
        );
      }
      existing.isActive = true;
      const saved = await this.assignmentRepo.save(existing);
      return this.toDto(saved);
    }

    const assignment = this.assignmentRepo.create({ bus, conductor });
    const saved = await this.assignmentRepo.save(assignment);
    return this.toDto(saved);
  }

  async unassign(
    busId: string,
    conductorId: string,
    ownerId: string,
  ): Promise<void> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    const assignment = await this.assignmentRepo.findOne({
      where: {
        bus: { id: busId },
        conductor: { id: conductorId },
        isActive: true,
      },
      relations: ['bus', 'conductor'],
    });
    if (!assignment) {
      throw new AppError('Active assignment not found', HttpStatus.NOT_FOUND);
    }

    assignment.isActive = false;
    await this.assignmentRepo.save(assignment);
  }

  async listConductors(
    busId: string,
    ownerId: string,
  ): Promise<BusAssignmentDto[]> {
    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    const assignments = await this.assignmentRepo.find({
      where: { bus: { id: busId }, isActive: true },
      relations: ['bus', 'conductor'],
    });
    return assignments.map((a) => this.toDto(a));
  }

  async listBusesByConductor(conductorId: string): Promise<BusDto[]> {
    const assignments = await this.assignmentRepo.find({
      where: { conductor: { id: conductorId }, isActive: true },
      relations: ['bus', 'bus.owner', 'conductor'],
    });
    return assignments.map((a) => this.busToDto(a.bus));
  }

  isAssigned(
    busId: string,
    conductorId: string,
  ): Promise<BusAssignment | null> {
    return this.assignmentRepo.findOne({
      where: {
        bus: { id: busId },
        conductor: { id: conductorId },
        isActive: true,
      },
    });
  }

  private toDto(a: BusAssignment): BusAssignmentDto {
    return {
      id: a.id,
      busId: a.bus?.id ?? '',
      conductorId: a.conductor?.id ?? '',
      isActive: a.isActive,
      assignedAt: a.assignedAt,
    };
  }

  private busToDto(bus: Bus): BusDto {
    return {
      id: bus.id,
      registrationNumber: bus.registrationNumber,
      model: bus.model,
      year: bus.year,
      totalSeats: bus.totalSeats,
      seatLayoutJson: bus.seatLayoutJson,
      approvalStatus: bus.approvalStatus,
      rejectionReason: bus.rejectionReason,
      ownerId: bus.owner?.id ?? '',
      createdAt: bus.createdAt,
      updatedAt: bus.updatedAt,
    };
  }
}
