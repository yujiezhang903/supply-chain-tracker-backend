import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {}

  private addProfitEfficiency(company: Company) {
    const annualRevenue = company.annualRevenue ?? 0;
    const employees = company.employees ?? 0;

    const profitEfficiency = employees > 0 ? annualRevenue / employees : 0;

    return {
      ...company,
      annualRevenue,
      employees,
      profitEfficiency,
    };
  }

  async create(createCompanyDto: CreateCompanyDto) {
    const company = this.companiesRepository.create({
      name: createCompanyDto.name,
      level: createCompanyDto.level ?? 'Level 1',
      country: createCompanyDto.country,
      city: createCompanyDto.city ?? '',
      foundedYear: createCompanyDto.foundedYear ?? null,
      annualRevenue: createCompanyDto.annualRevenue ?? 0,
      employees: createCompanyDto.employees ?? 0,
    });

    const savedCompany = await this.companiesRepository.save(company);

    return this.addProfitEfficiency(savedCompany);
  }

  async findAll() {
    const companies = await this.companiesRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });

    return companies.map((company) => this.addProfitEfficiency(company));
  }

  async findOne(id: string) {
    const company = await this.companiesRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.addProfitEfficiency(company);
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    const company = await this.companiesRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (updateCompanyDto.name !== undefined) {
      company.name = updateCompanyDto.name;
    }

    if (updateCompanyDto.level !== undefined) {
      company.level = updateCompanyDto.level;
    }

    if (updateCompanyDto.country !== undefined) {
      company.country = updateCompanyDto.country;
    }

    if (updateCompanyDto.city !== undefined) {
      company.city = updateCompanyDto.city;
    }

    if (updateCompanyDto.foundedYear !== undefined) {
      company.foundedYear = updateCompanyDto.foundedYear;
    }

    if (updateCompanyDto.annualRevenue !== undefined) {
      company.annualRevenue = updateCompanyDto.annualRevenue;
    }

    if (updateCompanyDto.employees !== undefined) {
      company.employees = updateCompanyDto.employees;
    }

    const updatedCompany = await this.companiesRepository.save(company);

    return this.addProfitEfficiency(updatedCompany);
  }

  async remove(id: string) {
    const company = await this.companiesRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.companiesRepository.delete(id);

    return {
      message: 'Company deleted successfully',
      id,
    };
  }
}
