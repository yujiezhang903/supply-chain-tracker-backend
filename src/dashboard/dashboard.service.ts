import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from '../companies/entities/company.entity';
import { Relationship } from '../relationships/entities/relationship.entity';
import { CompanyFilterDto } from './dto/company-filter.dto';

export type CompanyHierarchyNode = {
  id?: string;
  name: string;
  level?: string | null;
  country?: string | null;
  city?: string | null;
  foundedYear?: number | null;
  annualRevenue?: number | null;
  employees?: number | null;
  relationshipType?: string | null;
  productName?: string | null;
  relationshipValue?: number | null;
  value?: number;
  children?: CompanyHierarchyNode[];
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,

    @InjectRepository(Relationship)
    private readonly relationshipsRepository: Repository<Relationship>,
  ) {}

  async getCompaniesByFilter(request: CompanyFilterDto) {
    const { dimension, filter = {} } = request;

    this.validateRange(
      'Founded year',
      filter.founded_year?.start,
      filter.founded_year?.end,
    );

    this.validateRange(
      'Annual revenue',
      filter.annual_revenue?.min,
      filter.annual_revenue?.max,
    );

    this.validateRange(
      'Employees',
      filter.employees?.min,
      filter.employees?.max,
    );

    const query = this.companiesRepository.createQueryBuilder('company');

    if (filter.level?.length) {
      const levels = filter.level.map((level) =>
        this.normalizeLevel(level),
      );

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

    query.orderBy('company.name', 'ASC');

    const companies = await query.getMany();
    const companyIds = companies.map((company) => company.id);

    const relationships =
      companyIds.length === 0
        ? []
        : await this.relationshipsRepository
            .createQueryBuilder('relationship')
            .where(
              'relationship.sourceCompanyId IN (:...companyIds)',
              { companyIds },
            )
            .andWhere(
              'relationship.targetCompanyId IN (:...companyIds)',
              { companyIds },
            )
            .orderBy('relationship.createdAt', 'ASC')
            .getMany();

    const countByLabel = new Map<string, number>();

    companies.forEach((company) => {
      const rawLabel = company[dimension];
      const label = String(rawLabel ?? '').trim() || 'Unknown';

      countByLabel.set(label, (countByLabel.get(label) ?? 0) + 1);
    });

    const data = Array.from(countByLabel.entries())
      .map(([label, count]) => ({ label, count }))
      .sort(
        (a, b) =>
          b.count - a.count || a.label.localeCompare(b.label),
      );

    return {
      dimension,
      totalCompanies: companies.length,
      data,
      hierarchy: this.buildHierarchy(companies, relationships),
    };
  }

  private normalizeLevel(level: string | number) {
    const value = String(level).trim();

    if (/^\d+$/.test(value)) {
      return `Level ${value}`;
    }

    return value;
  }

  private validateRange(
    label: string,
    minimum?: number,
    maximum?: number,
  ) {
    if (
      minimum !== undefined &&
      maximum !== undefined &&
      minimum > maximum
    ) {
      throw new BadRequestException(
        `${label} minimum cannot be greater than maximum`,
      );
    }
  }

  private buildHierarchy(
    companies: Company[],
    relationships: Relationship[],
  ): CompanyHierarchyNode {
    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );

    const parentByChild = new Map<string, string>();
    const relationshipByChild = new Map<string, Relationship>();

    relationships.forEach((relationship) => {
      const childId = relationship.sourceCompanyId;
      const parentId = relationship.targetCompanyId;

      if (
        childId === parentId ||
        !companyById.has(childId) ||
        !companyById.has(parentId) ||
        parentByChild.has(childId) ||
        this.createsCycle(childId, parentId, parentByChild)
      ) {
        return;
      }

      parentByChild.set(childId, parentId);
      relationshipByChild.set(childId, relationship);
    });

    const childrenByParent = new Map<string, string[]>();

    parentByChild.forEach((parentId, childId) => {
      const children = childrenByParent.get(parentId) ?? [];
      children.push(childId);
      childrenByParent.set(parentId, children);
    });

    const compareCompanies = (firstId: string, secondId: string) => {
      const first = companyById.get(firstId);
      const second = companyById.get(secondId);

      const firstLevel = this.getLevelNumber(first?.level);
      const secondLevel = this.getLevelNumber(second?.level);

      return (
        firstLevel - secondLevel ||
        (first?.name ?? '').localeCompare(second?.name ?? '')
      );
    };

    const buildNode = (companyId: string): CompanyHierarchyNode => {
      const company = companyById.get(companyId);
      const relationship = relationshipByChild.get(companyId);

      if (!company) {
        return {
          name: 'Unknown company',
          value: 1,
        };
      }

      const childIds = (
        childrenByParent.get(companyId) ?? []
      ).sort(compareCompanies);

      const node: CompanyHierarchyNode = {
        id: company.id,
        name: company.name || 'Unnamed company',
        level: company.level,
        country: company.country,
        city: company.city,
        foundedYear: company.foundedYear,
        annualRevenue: company.annualRevenue,
        employees: company.employees,
        relationshipType: relationship?.relationshipType || null,
        productName: relationship?.productName || null,
        relationshipValue: relationship?.value ?? null,
        value: Math.max(company.employees ?? 1, 1),
      };

      if (childIds.length > 0) {
        node.children = childIds.map(buildNode);
      }

      return node;
    };

    const rootIds = companies
      .filter((company) => !parentByChild.has(company.id))
      .map((company) => company.id)
      .sort(compareCompanies);

    return {
      name: 'Company hierarchy',
      children: rootIds.map(buildNode),
    };
  }

  private createsCycle(
    childId: string,
    parentId: string,
    parentByChild: Map<string, string>,
  ) {
    let currentId: string | undefined = parentId;

    while (currentId) {
      if (currentId === childId) {
        return true;
      }

      currentId = parentByChild.get(currentId);
    }

    return false;
  }

  private getLevelNumber(level?: string | null) {
    const match = String(level ?? '').match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  }
}
