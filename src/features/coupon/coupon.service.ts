import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { AppError } from '../../common/exceptions/app.exception';
import { DiscountType } from './enums/discount-type.enum';
import { CouponDto, CouponValidationDto } from './dto/coupon.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponFilterDto } from './dto/coupon-filter.dto';
import { parsePage, parseLimit } from '../../utils/common/dto/pagination.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly usageRepo: Repository<CouponUsage>,
  ) {}

  // ─── Admin CRUD ───────────────────────────────────────────────────────────────

  async create(dto: CreateCouponDto): Promise<CouponDto> {
    const existing = await this.couponRepo.findOne({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new AppError('Coupon code already exists', HttpStatus.CONFLICT);
    }
    const coupon = this.couponRepo.create({
      ...dto,
      code: dto.code.toUpperCase(),
      perUserLimit: dto.perUserLimit ?? 1,
    });
    const saved = await this.couponRepo.save(coupon);
    return this.toDto(saved);
  }

  async findAll(
    filters: CouponFilterDto = {},
  ): Promise<{ items: CouponDto[]; total: number }> {
    const page = parsePage(filters.page);
    const limit = parseLimit(filters.limit);

    const qb = this.couponRepo.createQueryBuilder('coupon');

    if (filters.search) {
      qb.andWhere('coupon.code ILIKE :s', { s: `%${filters.search}%` });
    }

    if (filters.isActive !== undefined && filters.isActive !== '') {
      qb.andWhere('coupon.isActive = :active', {
        active: filters.isActive === 'true',
      });
    }

    const total = await qb.getCount();
    const coupons = await qb
      .orderBy('coupon.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items: coupons.map((c) => this.toDto(c)), total };
  }

  async findOne(id: string): Promise<CouponDto> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new AppError('Coupon not found', HttpStatus.NOT_FOUND);
    return this.toDto(coupon);
  }

  async update(id: string, dto: UpdateCouponDto): Promise<CouponDto> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new AppError('Coupon not found', HttpStatus.NOT_FOUND);
    Object.assign(coupon, dto);
    const saved = await this.couponRepo.save(coupon);
    return this.toDto(saved);
  }

  async deactivate(id: string): Promise<CouponDto> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new AppError('Coupon not found', HttpStatus.NOT_FOUND);
    coupon.isActive = false;
    const saved = await this.couponRepo.save(coupon);
    return this.toDto(saved);
  }

  // ─── Validation (used by BookingService and customer validate endpoint) ───────

  async validateForCustomer(
    code: string,
    customerId: string,
    fare: number,
  ): Promise<{ coupon: Coupon; discountAmount: number }> {
    const coupon = await this.couponRepo.findOne({
      where: { code: code.toUpperCase(), isActive: true },
    });
    if (!coupon) {
      throw new AppError(
        'Invalid or inactive coupon code',
        HttpStatus.BAD_REQUEST,
      );
    }

    const today = new Date().toISOString().substring(0, 10);
    if (today < coupon.validFrom || today > coupon.validUntil) {
      throw new AppError(
        'Coupon is expired or not yet valid',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError('Coupon usage limit reached', HttpStatus.BAD_REQUEST);
    }

    if (coupon.minFare !== null && fare < Number(coupon.minFare)) {
      throw new AppError(
        `Minimum fare of ${coupon.minFare} required for this coupon`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const customerUsageCount = await this.usageRepo.count({
      where: { coupon: { id: coupon.id }, customer: { id: customerId } },
    });
    if (customerUsageCount >= coupon.perUserLimit) {
      throw new AppError(
        'You have already used this coupon',
        HttpStatus.BAD_REQUEST,
      );
    }

    const discountAmount = this.calculateDiscount(coupon, fare);
    return { coupon, discountAmount };
  }

  calculateDiscount(coupon: Coupon, fare: number): number {
    let discount: number;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discount = (fare * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscount !== null) {
        discount = Math.min(discount, Number(coupon.maxDiscount));
      }
    } else {
      discount = Number(coupon.discountValue);
    }
    return Math.min(discount, fare);
  }

  async buildValidationDto(
    code: string,
    customerId: string,
    fare: number,
  ): Promise<CouponValidationDto> {
    const { coupon, discountAmount } = await this.validateForCustomer(
      code,
      customerId,
      fare,
    );
    return {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
      payableAmount: fare - discountAmount,
    };
  }

  toDto(coupon: Coupon): CouponDto {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minFare: coupon.minFare !== null ? Number(coupon.minFare) : null,
      maxDiscount:
        coupon.maxDiscount !== null ? Number(coupon.maxDiscount) : null,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      perUserLimit: coupon.perUserLimit,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt,
    };
  }
}
