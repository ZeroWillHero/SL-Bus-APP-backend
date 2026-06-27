import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
import { RouteStop } from './entities/route-stop.entity';
import { Bus } from '../bus/entities/bus.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteDto } from './dto/route.dto';
import { RouteStopDto } from './dto/route-stop.dto';
import { CreateRouteStopDto } from './dto/create-route-stop.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';
import { RouteFilterDto } from './dto/route-filter.dto';
import { parsePage, parseLimit } from '../../utils/common/dto/pagination.dto';

@Injectable()
export class RouteService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
    @InjectRepository(RouteStop)
    private readonly stopRepo: Repository<RouteStop>,
    @InjectRepository(Bus)
    private readonly busRepo: Repository<Bus>,
    @InjectRepository(BusOwner)
    private readonly ownerRepo: Repository<BusOwner>,
  ) {}

  async create(ownerId: string, dto: CreateRouteDto): Promise<RouteDto> {
    const owner = await this.ownerRepo.findOne({ where: { id: ownerId } });
    if (!owner) throw new AppError('Bus owner not found', HttpStatus.NOT_FOUND);

    const route = this.routeRepo.create({
      origin: dto.origin,
      destination: dto.destination,
      distanceKm: dto.distanceKm,
      estimatedDurationMin: dto.estimatedDurationMin,
      owner,
    });
    const saved = await this.routeRepo.save(route);
    saved.stops = [];
    return this.toDto(saved);
  }

  async findAllByOwner(
    ownerId: string,
    filters: RouteFilterDto = {},
  ): Promise<{ items: RouteDto[]; total: number }> {
    const page = parsePage(filters.page);
    const limit = parseLimit(filters.limit);
    const sortOrder = filters.sortOrder ?? 'DESC';

    const qb = this.routeRepo
      .createQueryBuilder('route')
      .leftJoinAndSelect('route.owner', 'owner')
      .leftJoinAndSelect('route.bus', 'bus')
      .leftJoinAndSelect('route.stops', 'stops')
      .where('owner.id = :ownerId', { ownerId });

    if (filters.origin) {
      qb.andWhere('route.origin ILIKE :origin', {
        origin: `%${filters.origin}%`,
      });
    }
    if (filters.destination) {
      qb.andWhere('route.destination ILIKE :destination', {
        destination: `%${filters.destination}%`,
      });
    }
    if (filters.search) {
      qb.andWhere(
        '(route.origin ILIKE :search OR route.destination ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const total = await qb.getCount();
    const routes = await qb
      .orderBy('route.createdAt', sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items: routes.map((r) => this.toDto(r)), total };
  }

  async findOne(routeId: string, ownerId: string): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus', 'stops'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);
    return this.toDto(route);
  }

  async update(
    routeId: string,
    ownerId: string,
    dto: UpdateRouteDto,
  ): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus', 'stops'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    Object.assign(route, {
      origin: dto.origin ?? route.origin,
      destination: dto.destination ?? route.destination,
      distanceKm: dto.distanceKm ?? route.distanceKm,
      estimatedDurationMin:
        dto.estimatedDurationMin ?? route.estimatedDurationMin,
    });

    await this.routeRepo.save(route);
    return this.toDto(route);
  }

  async deactivate(routeId: string, ownerId: string): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus', 'stops'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    route.isActive = false;
    await this.routeRepo.save(route);
    return this.toDto(route);
  }

  async assignToBus(
    routeId: string,
    busId: string,
    ownerId: string,
  ): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus', 'stops'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    const bus = await this.busRepo.findOne({
      where: { id: busId, owner: { id: ownerId } },
    });
    if (!bus) throw new AppError('Bus not found', HttpStatus.NOT_FOUND);

    route.bus = bus;
    await this.routeRepo.save(route);
    return this.toDto(route);
  }

  async unassignFromBus(
    routeId: string,
    busId: string,
    ownerId: string,
  ): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus', 'stops'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);
    if (route.bus?.id !== busId) {
      throw new AppError(
        'Route is not assigned to this bus',
        HttpStatus.BAD_REQUEST,
      );
    }

    route.bus = null;
    await this.routeRepo.save(route);
    return this.toDto(route);
  }

  async findAllByBus(busId: string, ownerId: string): Promise<RouteDto[]> {
    const routes = await this.routeRepo.find({
      where: { bus: { id: busId }, owner: { id: ownerId } },
      relations: ['owner', 'bus', 'stops'],
    });
    return routes.map((r) => this.toDto(r));
  }

  // ─── Stop management ─────────────────────────────────────────────────────────

  async addStop(
    routeId: string,
    ownerId: string,
    dto: CreateRouteStopDto,
  ): Promise<RouteStopDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    const stop = this.stopRepo.create({
      route,
      stopName: dto.stopName,
      stopOrder: dto.stopOrder,
      priceFromOrigin: dto.priceFromOrigin,
    });
    const saved = await this.stopRepo.save(stop);
    return this.toStopDto(saved);
  }

  async getStops(routeId: string, ownerId: string): Promise<RouteStopDto[]> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    const stops = await this.stopRepo.find({
      where: { route: { id: routeId } },
      order: { stopOrder: 'ASC' },
    });
    return stops.map((s) => this.toStopDto(s));
  }

  async updateStop(
    routeId: string,
    stopId: string,
    ownerId: string,
    dto: UpdateRouteStopDto,
  ): Promise<RouteStopDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    const stop = await this.stopRepo.findOne({
      where: { id: stopId, route: { id: routeId } },
    });
    if (!stop) throw new AppError('Stop not found', HttpStatus.NOT_FOUND);

    Object.assign(stop, {
      stopName: dto.stopName ?? stop.stopName,
      stopOrder: dto.stopOrder ?? stop.stopOrder,
      priceFromOrigin: dto.priceFromOrigin ?? stop.priceFromOrigin,
    });

    await this.stopRepo.save(stop);
    return this.toStopDto(stop);
  }

  async removeStop(
    routeId: string,
    stopId: string,
    ownerId: string,
  ): Promise<void> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    const stop = await this.stopRepo.findOne({
      where: { id: stopId, route: { id: routeId } },
    });
    if (!stop) throw new AppError('Stop not found', HttpStatus.NOT_FOUND);

    await this.stopRepo.remove(stop);
  }

  // ─── DTO helpers ─────────────────────────────────────────────────────────────

  toStopDto(stop: RouteStop): RouteStopDto {
    return {
      id: stop.id,
      stopName: stop.stopName,
      stopOrder: stop.stopOrder,
      priceFromOrigin: Number(stop.priceFromOrigin),
      createdAt: stop.createdAt,
    };
  }

  toDto(route: Route): RouteDto {
    const sortedStops = (route.stops ?? []).sort(
      (a, b) => a.stopOrder - b.stopOrder,
    );
    return {
      id: route.id,
      origin: route.origin,
      destination: route.destination,
      viaStops: sortedStops.map((s) => s.stopName),
      stops: sortedStops.map((s) => this.toStopDto(s)),
      distanceKm: Number(route.distanceKm),
      estimatedDurationMin: route.estimatedDurationMin,
      ownerId: route.owner?.id ?? '',
      busId: route.bus?.id ?? null,
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    };
  }
}
