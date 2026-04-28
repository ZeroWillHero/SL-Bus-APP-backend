import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScheduleService } from './schedule.service';
import { Schedule } from './entities/schedule.entity';
import { Bus } from '../bus/entities/bus.entity';
import { Route } from '../route/entities/route.entity';
import { RouteService } from '../route/route.service';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { ApprovalStatus } from '../bus/enums/approval-status.enum';

const mockOwner = { id: 'owner-uuid' } as BusOwner;

const mockBus = {
  id: 'bus-uuid',
  registrationNumber: 'NB-1234',
  model: 'Ashok Leyland',
  year: 2020,
  totalSeats: 40,
  seatLayoutJson: {},
  approvalStatus: ApprovalStatus.APPROVED,
  rejectionReason: null,
  owner: mockOwner,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Bus;

const mockRoute = {
  id: 'route-uuid',
  origin: 'Colombo',
  destination: 'Kandy',
  viaStops: [],
  distanceKm: 115.5,
  estimatedDurationMin: 180,
  isActive: true,
  owner: mockOwner,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Route;

const mockSchedule = {
  id: 'schedule-uuid',
  bus: mockBus,
  route: mockRoute,
  departureTime: '08:30',
  operatingDays: 62,
  baseFare: 350,
  isActive: true,
  createdAt: new Date(),
} as unknown as Schedule;

describe('ScheduleService', () => {
  let service: ScheduleService;
  let scheduleRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let busRepo: { findOne: jest.Mock };
  let routeRepo: { findOne: jest.Mock };
  let routeService: { toDto: jest.Mock };

  const makeQb = (result: unknown) => ({
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    scheduleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    busRepo = { findOne: jest.fn() };
    routeRepo = { findOne: jest.fn() };
    routeService = {
      toDto: jest.fn().mockReturnValue({ id: 'route-uuid' } as never),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: getRepositoryToken(Schedule), useValue: scheduleRepo },
        { provide: getRepositoryToken(Bus), useValue: busRepo },
        { provide: getRepositoryToken(Route), useValue: routeRepo },
        { provide: RouteService, useValue: routeService },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws 404 when bus not found', async () => {
      busRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('owner-uuid', {
          busId: 'bad',
          routeId: 'route-uuid',
          departureTime: '08:30',
          operatingDays: 62,
          baseFare: 350,
        }),
      ).rejects.toThrow();
    });

    it('throws 422 when bus is not APPROVED', async () => {
      busRepo.findOne.mockResolvedValue({
        ...mockBus,
        approvalStatus: ApprovalStatus.PENDING,
      });
      await expect(
        service.create('owner-uuid', {
          busId: 'bus-uuid',
          routeId: 'route-uuid',
          departureTime: '08:30',
          operatingDays: 62,
          baseFare: 350,
        }),
      ).rejects.toThrow();
    });

    it('throws 404 when route not found', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      routeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('owner-uuid', {
          busId: 'bus-uuid',
          routeId: 'bad',
          departureTime: '08:30',
          operatingDays: 62,
          baseFare: 350,
        }),
      ).rejects.toThrow();
    });

    it('creates and returns a schedule DTO', async () => {
      busRepo.findOne.mockResolvedValue(mockBus);
      routeRepo.findOne.mockResolvedValue(mockRoute);
      scheduleRepo.create.mockReturnValue(mockSchedule);
      scheduleRepo.save.mockResolvedValue(mockSchedule);
      const result = await service.create('owner-uuid', {
        busId: 'bus-uuid',
        routeId: 'route-uuid',
        departureTime: '08:30',
        operatingDays: 62,
        baseFare: 350,
      });
      expect(result.busId).toBe('bus-uuid');
      expect(result.routeId).toBe('route-uuid');
      expect(result.operatingDays).toBe(62);
      expect(result.isActive).toBe(true);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns schedules for the owner', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb([mockSchedule]));
      const result = await service.findAll('owner-uuid', {});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('schedule-uuid');
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws 404 when not found', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      await expect(service.findOne('bad', 'owner-uuid')).rejects.toThrow();
    });

    it('returns schedule DTO', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(mockSchedule));
      const result = await service.findOne('schedule-uuid', 'owner-uuid');
      expect(result.id).toBe('schedule-uuid');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws 404 when not found', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      await expect(
        service.update('bad', 'owner', { baseFare: 400 }),
      ).rejects.toThrow();
    });

    it('updates baseFare and returns DTO', async () => {
      const sched = { ...mockSchedule };
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(sched));
      scheduleRepo.save.mockResolvedValue(sched);
      const result = await service.update('schedule-uuid', 'owner-uuid', {
        baseFare: 400,
      });
      expect(result.baseFare).toBe(400);
    });
  });

  // ─── deactivate ───────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('throws 404 when not found', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(null));
      await expect(service.deactivate('bad', 'owner')).rejects.toThrow();
    });

    it('sets isActive to false', async () => {
      const sched = { ...mockSchedule, isActive: true };
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(sched));
      scheduleRepo.save.mockResolvedValue(sched);
      const result = await service.deactivate('schedule-uuid', 'owner-uuid');
      expect(result.isActive).toBe(false);
    });
  });
});
