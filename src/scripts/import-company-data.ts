import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { parse } from 'csv-parse/sync';

import { AppModule } from '../app.module';
import { Company } from '../companies/entities/company.entity';
import { Relationship } from '../relationships/entities/relationship.entity';

type CompanyCsvRow = {
  company_code?: string;
  company_name?: string;
  level?: string;
  country?: string;
  city?: string;
  founded_year?: string;
  annual_revenue?: string;
  employees?: string;
};

type RelationshipCsvRow = {
  company_code?: string;
  parent_company?: string;
};

type ValidatedCompany = {
  code: string;
  name: string;
  levelNumber: number;
  country: string;
  city: string;
  foundedYear: number | null;
  annualRevenue: number | null;
  employees: number | null;
};

type ValidatedRelationship = {
  childCode: string;
  parentCode: string | null;
};

function clean(value: string | undefined) {
  return String(value ?? '').trim();
}

function requiredText(value: string | undefined, field: string, line: number) {
  const result = clean(value);

  if (!result) {
    throw new Error(`Line ${line}: ${field} is required`);
  }

  return result;
}

function optionalNumber(
  value: string | undefined,
  field: string,
  line: number,
  integer = false,
) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  const result = Number(text);

  if (!Number.isFinite(result) || (integer && !Number.isInteger(result))) {
    throw new Error(`Line ${line}: invalid ${field}: ${text}`);
  }

  return result;
}

async function main() {
  const replace = process.argv.includes('--replace');

  const companiesPath = resolve(process.cwd(), 'data', 'companies_0708.csv');
  const relationshipsPath = resolve(
    process.cwd(),
    'data',
    'relationships_0708.csv',
  );

  const companyRows = parse(await readFile(companiesPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CompanyCsvRow[];

  const relationshipRows = parse(await readFile(relationshipsPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as RelationshipCsvRow[];

  if (companyRows.length === 0) {
    throw new Error('Company CSV is empty');
  }

  if (relationshipRows.length === 0) {
    throw new Error('Relationship CSV is empty');
  }

  const companies: ValidatedCompany[] = [];
  const companyByCode = new Map<string, ValidatedCompany>();

  companyRows.forEach((row, index) => {
    const line = index + 2;
    const code = requiredText(row.company_code, 'company_code', line);
    const name = requiredText(row.company_name, 'company_name', line);
    const levelNumber = optionalNumber(row.level, 'level', line, true);

    if (levelNumber === null || levelNumber < 1) {
      throw new Error(`Line ${line}: level must be at least 1`);
    }

    if (companyByCode.has(code)) {
      throw new Error(`Line ${line}: duplicate company code ${code}`);
    }

    const company: ValidatedCompany = {
      code,
      name,
      levelNumber,
      country: clean(row.country),
      city: clean(row.city),
      foundedYear: optionalNumber(row.founded_year, 'founded_year', line, true),
      annualRevenue: optionalNumber(row.annual_revenue, 'annual_revenue', line),
      employees: optionalNumber(row.employees, 'employees', line, true),
    };

    companies.push(company);
    companyByCode.set(code, company);
  });

  const relationships: ValidatedRelationship[] = [];
  const parentByChild = new Map<string, string | null>();

  relationshipRows.forEach((row, index) => {
    const line = index + 2;
    const childCode = requiredText(row.company_code, 'company_code', line);
    const parentText = clean(row.parent_company);
    const parentCode = parentText || null;

    if (!companyByCode.has(childCode)) {
      throw new Error(`Line ${line}: unknown company code ${childCode}`);
    }

    if (parentCode && !companyByCode.has(parentCode)) {
      throw new Error(`Line ${line}: unknown parent company ${parentCode}`);
    }

    if (childCode === parentCode) {
      throw new Error(`Line ${line}: company cannot be its own parent`);
    }

    if (parentByChild.has(childCode)) {
      throw new Error(`Line ${line}: duplicate relationship for ${childCode}`);
    }

    relationships.push({ childCode, parentCode });
    parentByChild.set(childCode, parentCode);
  });

  for (const company of companies) {
    if (!parentByChild.has(company.code)) {
      throw new Error(`Missing relationship row for company ${company.code}`);
    }
  }

  const roots = relationships.filter(
    (relationship) => relationship.parentCode === null,
  );

  if (roots.length !== 1) {
    throw new Error(`Expected exactly one root company, found ${roots.length}`);
  }

  function calculateDepth(companyCode: string) {
    const visited = new Set<string>([companyCode]);
    let currentCode = companyCode;
    let depth = 1;

    while (true) {
      const parentCode = parentByChild.get(currentCode);

      if (parentCode === undefined) {
        throw new Error(`Missing hierarchy information for ${currentCode}`);
      }

      if (parentCode === null) {
        return depth;
      }

      if (visited.has(parentCode)) {
        throw new Error(`Hierarchy cycle detected at ${parentCode}`);
      }

      visited.add(parentCode);
      currentCode = parentCode;
      depth += 1;
    }
  }

  const levelCounts = new Map<number, number>();

  for (const company of companies) {
    const actualDepth = calculateDepth(company.code);

    if (actualDepth !== company.levelNumber) {
      throw new Error(
        `${company.code}: CSV level ${company.levelNumber} ` +
          `does not match hierarchy depth ${actualDepth}`,
      );
    }

    levelCounts.set(
      company.levelNumber,
      (levelCounts.get(company.levelNumber) ?? 0) + 1,
    );
  }

  const actualRelationships = relationships.filter(
    (relationship) => relationship.parentCode !== null,
  );

  console.log(`Validated companies: ${companies.length}`);
  console.log(`Validated relationships: ${actualRelationships.length}`);
  console.log(`Root company: ${roots[0].childCode}`);
  console.log(
    [...levelCounts.entries()]
      .sort(([first], [second]) => first - second)
      .map(([level, count]) => `Level ${level}: ${count}`)
      .join(', '),
  );

  if (!replace) {
    console.log('Validation passed. Database was not changed.');
    console.log(
      'Use --replace only after confirming deletion of existing data.',
    );
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);

    await dataSource.transaction(async (manager) => {
      const companyRepository = manager.getRepository(Company);
      const relationshipRepository = manager.getRepository(Relationship);

      await relationshipRepository.clear();
      await companyRepository.clear();

      const companyEntities = companies.map((company) =>
        companyRepository.create({
          name: company.name,
          level: `Level ${company.levelNumber}`,
          country: company.country,
          city: company.city,
          foundedYear: company.foundedYear,
          annualRevenue: company.annualRevenue,
          employees: company.employees,
        }),
      );

      await companyRepository.save(companyEntities, {
        chunk: 500,
      });

      const idByCode = new Map(
        companies.map((company, index) => [
          company.code,
          companyEntities[index].id,
        ]),
      );

      const relationshipEntities = actualRelationships.map(
        ({ childCode, parentCode }) => {
          const sourceCompanyId = idByCode.get(childCode);
          const targetCompanyId = idByCode.get(parentCode!);

          if (!sourceCompanyId || !targetCompanyId) {
            throw new Error(
              `Cannot resolve relationship ${childCode} -> ${parentCode}`,
            );
          }

          return relationshipRepository.create({
            sourceCompanyId,
            targetCompanyId,
            relationshipType: 'Hierarchy',
            productName: '',
            value: 0,
            description: `${childCode} belongs to ${parentCode}`,
          });
        },
      );

      await relationshipRepository.save(relationshipEntities, {
        chunk: 500,
      });

      const companyCount = await companyRepository.count();
      const relationshipCount = await relationshipRepository.count();

      if (
        companyCount !== companies.length ||
        relationshipCount !== actualRelationships.length
      ) {
        throw new Error(
          `Import count mismatch: companies=${companyCount}, ` +
            `relationships=${relationshipCount}`,
        );
      }

      console.log(`Imported companies: ${companyCount}`);
      console.log(`Imported relationships: ${relationshipCount}`);
    });
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
