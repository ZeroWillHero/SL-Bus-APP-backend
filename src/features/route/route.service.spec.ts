import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RouteService } from './route.service';
import { Route } from './entities/route.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';

const mockOwner = { id: 'owner-uuid' } as BusOwner;

const mockRoute = {
  id: 'route-uuid',
  origin: 'Colombo',
  destination: 'Kandy',
  viaStops: ['Kadawatha'],
  distanceKm: 115.5,
  estimatedDurationMin: 180,
  isActive: true,
  owner: mockOwner,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Route;

describe('RouteService', () => {
  let service: RouteService;
  let routeRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let ownerRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    routeRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    ownerRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouteService,
        { provide: getRepositoryToken(Route), useValue: routeRepo },
        { provide: getRepositoryToken(BusOwner), useValue: ownerRepo },
      ],
    }).compile();

    service = module.get<RouteService>(RouteService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws 404 when owner not found', async () => {
      ownerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('bad-owner', {
          origin: 'A',
          destination: 'B',
          distanceKm: 10,
          estimatedDurationMin: 30,
        }),
      ).rejects.toThrow();
    });

    it('creates and returns a route DTO', async () => {
      ownerRepo.findOne.mockResolvedValue(mockOwner);
      routeRepo.create.mockReturnValue(mockRoute);
      routeRepo.save.mockResolvedValue(mockRoute);
      const result = await service.create('owner-uuid', {
        origin: 'Colombo',
        destination: 'Kandy',
        distanceKm: 115.5,
        estimatedDurationMin: 180,
      });
      expect(result.origin).toBe('Colombo');
      expect(result.destination).toBe('Kandy');
      expect(result.ownerId).toBe('owner-uuid');
      expect(result.isActive).toBe(true);
    });
  });

  // ─── findAllByOwner ────────────────────────────────────────────────────────

  describe('findAllByOwner', () => {
    it('returns all routes for the owner', async () => {
      routeRepo.find.mockResolvedValue([mockRoute]);
      const result = await service.findAllByOwner('owner-uuid');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('route-uuid');
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws 404 when not found', async () => {
      routeRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'owner-uuid')).rejects.toThrow();
    });

    it('returns route DTO', async () => {
      routeRepo.findOne.mockResolvedValue(mockRoute);
      const result = await service.findOne('route-uuid', 'owner-uuid');
      expect(result.id).toBe('route-uuid');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws 404 when route not found', async () => {
      routeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('bad', 'owner', { origin: 'X' }),
      ).rejects.toThrow();
    });

    it('updates fields and returns DTO', async () => {
      const route = { ...mockRoute };
      routeRepo.findOne.mockResolvedValue(route);
      routeRepo.save.mockResolvedValue(route);
      const result = await service.update('route-uuid', 'owner-uuid', {
        origin: 'Galle',
      });
      expect(result.origin).toBe('Galle');
    });
  });

  // ─── deactivate ───────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('throws 404 when route not found', async () => {
      routeRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivate('bad', 'owner')).rejects.toThrow();
    });

    it('sets isActive to false', async () => {
      const route = { ...mockRoute, isActive: true };
      routeRepo.findOne.mockResolvedValue(route);
      routeRepo.save.mockResolvedValue(route);
      const result = await service.deactivate('route-uuid', 'owner-uuid');
      expect(result.isActive).toBe(false);
    });
  });

  // ─── toDto ────────────────────────────────────────────────────────────────

  describe('toDto', () => {
    it('maps all fields correctly', () => {
      const dto = service.toDto(mockRoute);
      expect(dto.id).toBe('route-uuid');
      expect(dto.ownerId).toBe('owner-uuid');
      expect(dto.viaStops).toEqual(['Kadawatha']);
    });
  });
});
