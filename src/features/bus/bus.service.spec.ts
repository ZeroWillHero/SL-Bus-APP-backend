import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusService } from './bus.service';
import { Bus } from './entities/bus.entity';
import { BusDocument } from './entities/bus-document.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { ApprovalStatus } from './enums/approval-status.enum';
import { DocumentType } from './enums/document-type.enum';

const mockOwner = { id: 'owner-uuid' } as BusOwner;

const mockBus = {
  id: 'bus-uuid',
  registrationNumber: 'NB-1234',
  model: 'Ashok Leyland',
  year: 2020,
  totalSeats: 40,
  seatLayoutJson: { rows: 10, columns: 4 },
  approvalStatus: ApprovalStatus.PENDING,
  rejectionReason: null,
  owner: mockOwner,
  documents: [],
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Bus;

const mockDoc = {
  id: 'doc-uuid',
  bus: { id: 'bus-uuid' },
  documentType: DocumentType.RC,
  fileData: 'base64data',
  uploadedAt: new Date(),
  verifiedAt: null,
  verifiedByAdminId: null,
} as unknown as BusDocument;

describe('BusService', () => {
  let service: BusService;
  let busRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let docRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let ownerRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    busRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    docRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    ownerRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusService,
        { provide: getRepositoryToken(Bus), useValue: busRepo },
        { provide: getRepositoryToken(BusDocument), useValue: docRepo },
        { provide: getRepositoryToken(BusOwner), useValue: ownerRepo },
      ],
    }).compile();

    service = module.get<BusService>(BusService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws 404 when owner not found', async () => {
      ownerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('bad-owner', {
          registrationNumber: 'X',
          model: 'Y',
          year: 2020,
          totalSeats: 10,
          seatLayoutJson: { rows: 5, columns: 2 },
        }),
      ).rejects.toThrow();
    });

    it('throws 409 on duplicate registration number', async () => {
      ownerRepo.findOne.mockResolvedValue(mockOwner);
      busRepo.findOne.mockResolvedValue(mockBus); // duplicate
      await expect(
        service.create('owner-uuid', {
          registrationNumber: 'NB-1234',
          model: 'Y',
          year: 2020,
          totalSeats: 10,
          seatLayoutJson: { rows: 5, columns: 2 },
        }),
      ).rejects.toThrow();
    });

    it('creates and returns a bus DTO with PENDING status', async () => {
      ownerRepo.findOne.mockResolvedValue(mockOwner);
      busRepo.findOne.mockResolvedValue(null);
      busRepo.create.mockReturnValue(mockBus);
      busRepo.save.mockResolvedValue(mockBus);
      const result = await service.create('owner-uuid', {
        registrationNumber: 'NB-9999',
        model: 'Leyland',
        year: 2021,
        totalSeats: 40,
        seatLayoutJson: { rows: 10, columns: 4 },
      });
      expect(result.approvalStatus).toBe(ApprovalStatus.PENDING);
      expect(result.registrationNumber).toBe('NB-1234');
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws 403 when bus is APPROVED', async () => {
      busRepo.findOne.mockResolvedValue({
        ...mockBus,
        approvalStatus: ApprovalStatus.APPROVED,
      });
      await expect(
        service.update('bus-uuid', 'owner-uuid', { model: 'New' }),
      ).rejects.toThrow();
    });

    it('updates a PENDING bus and resets status to PENDING', async () => {
      const bus = { ...mockBus, approvalStatus: ApprovalStatus.PENDING };
      busRepo.findOne.mockResolvedValue(bus);
      busRepo.save.mockResolvedValue(bus);
      const result = await service.update('bus-uuid', 'owner-uuid', {
        model: 'Updated',
      });
      expect(result.approvalStatus).toBe(ApprovalStatus.PENDING);
    });

    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('bad', 'owner', { model: 'X' }),
      ).rejects.toThrow();
    });
  });

  // ─── approve / reject ──────────────────────────────────────────────────────

  describe('approve', () => {
    it('sets approvalStatus to APPROVED and clears rejectionReason', async () => {
      const bus = { ...mockBus, approvalStatus: ApprovalStatus.PENDING };
      busRepo.findOne.mockResolvedValue(bus);
      busRepo.save.mockResolvedValue(bus);
      const result = await service.approve('bus-uuid');
      expect(result.approvalStatus).toBe(ApprovalStatus.APPROVED);
      expect(result.rejectionReason).toBeNull();
    });

    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(service.approve('bad')).rejects.toThrow();
    });
  });

  describe('reject', () => {
    it('sets approvalStatus to REJECTED and stores reason', async () => {
      const bus = { ...mockBus };
      busRepo.findOne.mockResolvedValue(bus);
      busRepo.save.mockResolvedValue(bus);
      const result = await service.reject('bus-uuid', 'Insurance expired');
      expect(result.approvalStatus).toBe(ApprovalStatus.REJECTED);
      expect(result.rejectionReason).toBe('Insurance expired');
    });

    it('throws 400 when reason is empty', async () => {
      await expect(service.reject('bus-uuid', '')).rejects.toThrow();
    });

    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(service.reject('bad', 'reason')).rejects.toThrow();
    });
  });

  // ─── documents ─────────────────────────────────────────────────────────────

  describe('uploadDocument', () => {
    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(
        service.uploadDocument('bad', 'owner', {
          documentType: DocumentType.RC,
          fileData: 'base64',
        }),
      ).rejects.toThrow();
    });

    it('saves document and returns DTO with fileData', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      docRepo.create.mockReturnValue(mockDoc);
      docRepo.save.mockResolvedValue(mockDoc);
      const result = await service.uploadDocument('bus-uuid', 'owner-uuid', {
        documentType: DocumentType.RC,
        fileData: 'base64data',
      });
      expect(result.fileData).toBe('base64data');
      expect(result.documentType).toBe(DocumentType.RC);
    });
  });

  describe('listDocuments', () => {
    it('returns metadata without fileData', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      docRepo.find.mockResolvedValue([mockDoc]);
      const result = await service.listDocuments('bus-uuid', 'owner-uuid');
      expect(result[0].fileData).toBeUndefined();
      expect(result[0].documentType).toBe(DocumentType.RC);
    });
  });

  // ─── toDto ─────────────────────────────────────────────────────────────────

  describe('toDto', () => {
    it('maps all fields correctly', () => {
      const dto = service.toDto(mockBus);
      expect(dto.id).toBe('bus-uuid');
      expect(dto.ownerId).toBe('owner-uuid');
      expect(dto.approvalStatus).toBe(ApprovalStatus.PENDING);
    });
  });
});
