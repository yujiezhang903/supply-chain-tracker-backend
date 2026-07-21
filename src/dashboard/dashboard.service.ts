import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from '../companies/entities/company.entity';
import { CompanyFilterDto } from './dto/company-filter.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {}

  async getCompaniesByFilter(request: CompanyFilterDto) {
    const { dimension, filter = {} } = request;

    const dimensionColumns = {
      level: 'company.level',
      country: 'company.country',
      city: 'company.city',
    } as const;

    const dimensionColumn = dimensionColumns[dimension];

    const query = this.companiesRepository
      .createQueryBuilder('company')
      .select(dimensionColumn, 'label')
      .addSelect('COUNT(company.id)', 'count')
      .where(`${dimensionColumn} IS NOT NULL`)
      .andWhere(`${dimensionColumn} != ''`);

    if (filter.level?.length) {
      const levels = filter.level.map((level) => {
        const value = String(level).trim();

        if (/^\d+$/.test(value)) {
          return `Level ${value}`;
        }

        return value;
      });

      query.andWhere('company.level IN (:...levels)', { levels });
    }

    if (filter.country?.length) {
      query.andWhere('company.country IN (:...countries)', {
        countries: filter.country,
      });
    }

    if (filter.city?.length) {
      query.andWhere('company.city IN (:...cities)', {
        cities: filter.city,
      });
    }

    if (filter.founded_year?.start !== undefined) {
      query.andWhere('company.foundedYear >= :foundedYearStart', {
        foundedYearStart: filter.founded_year.start,
      });
    }

    if (filter.founded_year?.end !== undefined) {
      query.andWhere('company.foundedYear <= :foundedYearEnd', {
        foundedYearEnd: filter.founded_year.end,
      });
    }

    if (filter.annual_revenue?.min !== undefined) {
      query.andWhere('company.annualRevenue >= :annualRevenueMin', {
        annualRevenueMin: filter.annual_revenue.min,
      });
    }

    if (filter.annual_revenue?.max !== undefined) {
      query.andWhere('company.annualRevenue <= :annualRevenueMax', {
        annualRevenueMax: filter.annual_revenue.max,
      });
    }

    if (filter.employees?.min !== undefined) {
      query.andWhere('company.employees >= :employeesMin', {
        employeesMin: filter.employees.min,
      });
    }

    if (filter.employees?.max !== undefined) {
      query.andWhere('company.employees <= :employeesMax', {
        employeesMax: filter.employees.max,
      });
    }

    query
      .groupBy(dimensionColumn)
      .orderBy('count', 'DESC')
      .addOrderBy(dimensionColumn, 'ASC');

    const rawData = await query.getRawMany<{
      label: string;
      count: string;
    }>();

    const data = rawData.map((item) => ({
      label: item.label,
      count: Number(item.count),
    }));

    const totalCompanies = data.reduce(
      (total, item) => total + item.count,
      0,
    );

    return {
      dimension,
      totalCompanies,
      data,
    };
  }
}
