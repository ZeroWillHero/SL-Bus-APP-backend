import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { Schedule } from '../schedule/entities/schedule.entity';
import { ApprovalStatus } from '../bus/enums/approval-status.enum';

const mockOwner = {
  id: 'owner-uuid',
  firstName: 'Kamal',
  lastName: 'Perera',
};

const mockBus = {
  id: 'bus-uuid',
  registrationNumber: 'NB-1234',
  model: 'Ashok Leyland',
  totalSeats: 40,
  approvalStatus: ApprovalStatus.APPROVED,
  owner: mockOwner,
};

const mockRoute = {
  id: 'route-uuid',
  origin: 'Colombo',
  destination: 'Kandy',
  viaStops: ['Kadawatha'],
  distanceKm: 115.5,
  estimatedDurationMin: 180,
  isActive: true,
};

const mockSchedule = {
  id: 'schedule-uuid',
  bus: mockBus,
  route: mockRoute,
  departureTime: '08:30:00',
  operatingDays: 62,
  baseFare: 350,
  isActive: true,
  createdAt: new Date(),
} as unknown as Schedule;

const makeQb = (count: number, items: unknown[]) => {
  const qb = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
    getMany: jest.fn().mockResolvedValue(items),
  };
  return qb;
};

describe('SearchService', () => {
  let service: SearchService;
  let scheduleRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    scheduleRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(Schedule), useValue: scheduleRepo },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── findBuses ────────────────────────────────────────────────────────────

  describe('findBuses', () => {
    it('returns paginated results with correct structure', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(
        makeQb(1, [mockSchedule]),
      );
      const result = await service.findBuses(
        'Colombo',
        'Kandy',
        '2026-05-04',
        1,
        20,
        'time_asc',
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.pages).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('maps schedule to SearchResultDto correctly', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(
        makeQb(1, [mockSchedule]),
      );
      const result = await service.findBuses(
        'Colombo',
        'Kandy',
        '2026-05-04',
        1,
        20,
        'time_asc',
      );
      const item = result.data[0];
      expect(item.scheduleId).toBe('schedule-uuid');
      expect(item.busId).toBe('bus-uuid');
      expect(item.registrationNumber).toBe('NB-1234');
      expect(item.operatorName).toBe('Kamal Perera');
      expect(item.origin).toBe('Colombo');
      expect(item.destination).toBe('Kandy');
      expect(item.viaStops).toEqual(['Kadawatha']);
      expect(item.departureTime).toBe('08:30');
      expect(item.estimatedArrival).toBe('11:30');
      expect(item.baseFare).toBe(350);
      expect(item.totalSeats).toBe(40);
      expect(item.availableSeats).toBe(40);
    });

    it('returns empty results when no schedules found', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(makeQb(0, []));
      const result = await service.findBuses(
        'Galle',
        'Matara',
        '2026-05-04',
        1,
        20,
        'time_asc',
      );
      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
      expect(result.pages).toBe(0);
    });

    it('respects pagination parameters', async () => {
      scheduleRepo.createQueryBuilder.mockReturnValue(
        makeQb(50, [mockSchedule]),
      );
      const result = await service.findBuses(
        'Colombo',
        'Kandy',
        '2026-05-04',
        2,
        10,
        'time_asc',
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(5);
    });

    it('passes fare_desc sort to query builder', async () => {
      const qb = makeQb(1, [mockSchedule]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findBuses(
        'Colombo',
        'Kandy',
        '2026-05-04',
        1,
        20,
        'fare_desc',
      );
      expect(qb.orderBy).toHaveBeenCalledWith('s.baseFare', 'DESC');
    });

    it('defaults to time_asc for unknown sort value', async () => {
      const qb = makeQb(1, [mockSchedule]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findBuses(
        'Colombo',
        'Kandy',
        '2026-05-04',
        1,
        20,
        'invalid',
      );
      expect(qb.orderBy).toHaveBeenCalledWith('s.departureTime', 'ASC');
    });
  });
});
