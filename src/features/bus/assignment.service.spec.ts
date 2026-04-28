import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssignmentService } from './assignment.service';
import { BusAssignment } from './entities/bus-assignment.entity';
import { Bus } from './entities/bus.entity';
import { Conductor } from '../conductor/entities/conductor.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { ApprovalStatus } from './enums/approval-status.enum';

const mockOwner = { id: 'owner-uuid' } as BusOwner;

const mockBus = {
  id: 'bus-uuid',
  registrationNumber: 'NB-1234',
  model: 'Ashok Leyland',
  year: 2020,
  totalSeats: 40,
  seatLayoutJson: { rows: 10, columns: 4 },
  approvalStatus: ApprovalStatus.APPROVED,
  rejectionReason: null,
  owner: mockOwner,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Bus;

const mockConductor = {
  id: 'conductor-uuid',
  firstName: 'John',
  lastName: 'Doe',
} as unknown as Conductor;

const mockAssignment = {
  id: 'assignment-uuid',
  bus: mockBus,
  conductor: mockConductor,
  isActive: true,
  assignedAt: new Date(),
} as unknown as BusAssignment;

describe('AssignmentService', () => {
  let service: AssignmentService;
  let assignmentRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let busRepo: { findOne: jest.Mock };
  let conductorRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    assignmentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    busRepo = { findOne: jest.fn() };
    conductorRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentService,
        {
          provide: getRepositoryToken(BusAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Bus), useValue: busRepo },
        { provide: getRepositoryToken(Conductor), useValue: conductorRepo },
      ],
    }).compile();

    service = module.get<AssignmentService>(AssignmentService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── assign ────────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assign('bad-bus', 'conductor-uuid', 'owner-uuid'),
      ).rejects.toThrow();
    });

    it('throws 422 when bus is not APPROVED', async () => {
      busRepo.findOne.mockResolvedValue({
        ...mockBus,
        approvalStatus: ApprovalStatus.PENDING,
      });
      await expect(
        service.assign('bus-uuid', 'conductor-uuid', 'owner-uuid'),
      ).rejects.toThrow();
    });

    it('throws 404 when conductor not found', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      conductorRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assign('bus-uuid', 'bad-conductor', 'owner-uuid'),
      ).rejects.toThrow();
    });

    it('throws 409 when conductor is already actively assigned', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      conductorRepo.findOne.mockResolvedValue(mockConductor);
      assignmentRepo.findOne.mockResolvedValue(mockAssignment);
      await expect(
        service.assign('bus-uuid', 'conductor-uuid', 'owner-uuid'),
      ).rejects.toThrow();
    });

    it('reactivates an inactive assignment', async () => {
      const inactive = { ...mockAssignment, isActive: false };
      busRepo.findOne.mockResolvedValue(mockBus);
      conductorRepo.findOne.mockResolvedValue(mockConductor);
      assignmentRepo.findOne.mockResolvedValue(inactive);
      assignmentRepo.save.mockResolvedValue({ ...inactive, isActive: true });
      const result = await service.assign(
        'bus-uuid',
        'conductor-uuid',
        'owner-uuid',
      );
      expect(result.isActive).toBe(true);
    });

    it('creates a new assignment and returns DTO', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      conductorRepo.findOne.mockResolvedValue(mockConductor);
      assignmentRepo.findOne.mockResolvedValue(null);
      assignmentRepo.create.mockReturnValue(mockAssignment);
      assignmentRepo.save.mockResolvedValue(mockAssignment);
      const result = await service.assign(
        'bus-uuid',
        'conductor-uuid',
        'owner-uuid',
      );
      expect(result.busId).toBe('bus-uuid');
      expect(result.conductorId).toBe('conductor-uuid');
      expect(result.isActive).toBe(true);
    });
  });

  // ─── unassign ──────────────────────────────────────────────────────────────

  describe('unassign', () => {
    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(
        service.unassign('bad-bus', 'conductor-uuid', 'owner-uuid'),
      ).rejects.toThrow();
    });

    it('throws 404 when active assignment not found', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      assignmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.unassign('bus-uuid', 'conductor-uuid', 'owner-uuid'),
      ).rejects.toThrow();
    });

    it('sets isActive to false', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      assignmentRepo.findOne.mockResolvedValue({ ...mockAssignment });
      assignmentRepo.save.mockResolvedValue({
        ...mockAssignment,
        isActive: false,
      });
      await expect(
        service.unassign('bus-uuid', 'conductor-uuid', 'owner-uuid'),
      ).resolves.toBeUndefined();
      expect(assignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ─── listConductors ────────────────────────────────────────────────────────

  describe('listConductors', () => {
    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(
        service.listConductors('bad-bus', 'owner-uuid'),
      ).rejects.toThrow();
    });

    it('returns active assignments for the bus', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      assignmentRepo.find.mockResolvedValue([mockAssignment]);
      const result = await service.listConductors('bus-uuid', 'owner-uuid');
      expect(result).toHaveLength(1);
      expect(result[0].conductorId).toBe('conductor-uuid');
    });
  });

  // ─── listBusesByConductor ──────────────────────────────────────────────────

  describe('listBusesByConductor', () => {
    it('returns buses for active assignments', async () => {
      assignmentRepo.find.mockResolvedValue([mockAssignment]);
      const result = await service.listBusesByConductor('conductor-uuid');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('bus-uuid');
      expect(result[0].approvalStatus).toBe(ApprovalStatus.APPROVED);
    });

    it('returns empty array when no assignments', async () => {
      assignmentRepo.find.mockResolvedValue([]);
      const result = await service.listBusesByConductor('conductor-uuid');
      expect(result).toHaveLength(0);
    });
  });
});
