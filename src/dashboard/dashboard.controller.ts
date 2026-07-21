import { Body, Controller, Post } from '@nestjs/common';

import { DashboardService } from './dashboard.service';
import { CompanyFilterDto } from './dto/company-filter.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post('companies/filter')
  getCompaniesByFilter(@Body() request: CompanyFilterDto) {
    return this.dashboardService.getCompaniesByFilter(request);
  }
}
