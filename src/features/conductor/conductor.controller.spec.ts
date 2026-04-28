import { Test, TestingModule } from '@nestjs/testing';
import { ConductorController } from './conductor.controller';
import { ConductorService } from './conductor.service';
import { AssignmentService } from '../bus/assignment.service';

describe('ConductorController', () => {
  let controller: ConductorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConductorController],
      providers: [
        {
          provide: ConductorService,
          useValue: { findAll: jest.fn(), findByUserId: jest.fn() },
        },
        {
          provide: AssignmentService,
          useValue: { listBusesByConductor: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ConductorController>(ConductorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
