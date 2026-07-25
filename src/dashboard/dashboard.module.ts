import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Company } from '../companies/entities/company.entity';
import { Relationship } from '../relationships/entities/relationship.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Relationship])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
