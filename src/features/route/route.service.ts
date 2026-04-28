import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
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
      relations: ['owner'],
    });
    return routes.map((r) => this.toDto(r));
  }

  async findOne(routeId: string, ownerId: string): Promise<RouteDto> {
    const route = await this.routeRepo.findOne({
      where: { id: routeId, owner: { id: ownerId } },
      relations: ['owner'],
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
      relations: ['owner'],
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
      relations: ['owner'],
    });
    if (!route) throw new AppError('Route not found', HttpStatus.NOT_FOUND);

    route.isActive = false;
    await this.routeRepo.save(route);
    return this.toDto(route);
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
      isActive: route.isActive,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    };
  }
}
