import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
import { Bus } from '../bus/entities/bus.entity';
import { BusOwner } from '../bus-owner/entities/bus-owner.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteDto } from './dto/route.dto';

@Injectable()
export class RouteService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
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
      viaStops: dto.viaStops ?? [],
      distanceKm: dto.distanceKm,
      estimatedDurationMin: dto.estimatedDurationMin,
      owner,
    });
    const saved = await this.routeRepo.save(route);
    return this.toDto(saved);
  }

  async findAllByOwner(ownerId: string): Promise<RouteDto[]> {
    const routes = await this.routeRepo.find({
      where: { owner: { id: ownerId } },
      relations: ['owner', 'bus'],
    });
    return routes.map((r) => this.toDto(r));
  }

  async findOne(routeId: string, ownerId: string): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus'],
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
      relations: ['owner', 'bus'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    Object.assign(route, {
      origin: dto.origin ?? route.origin,
      destination: dto.destination ?? route.destination,
      viaStops: dto.viaStops ?? route.viaStops,
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
      relations: ['owner', 'bus'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    route.isActive = false;
    await this.routeRepo.save(route);
    return this.toDto(route);
  }

  async assignToBus(routeId: string, busId: string, ownerId: string): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus'],
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

  async unassignFromBus(routeId: string, busId: string, ownerId: string): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner', 'bus'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);
    if (route.bus?.id !== busId) {
      throw new AppError('Route is not assigned to this bus', HttpStatus.BAD_REQUEST);
    }

    route.bus = null;
    await this.routeRepo.save(route);
    return this.toDto(route);
  }

  async findAllByBus(busId: string, ownerId: string): Promise<RouteDto[]> {
    const routes = await this.routeRepo.find({
      where: { bus: { id: busId }, owner: { id: ownerId } },
      relations: ['owner', 'bus'],
    });
    return routes.map((r) => this.toDto(r));
  }

  toDto(route: Route): RouteDto {
    return {
      id: route.id,
      origin: route.origin,
      destination: route.destination,
      viaStops: route.viaStops,
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
