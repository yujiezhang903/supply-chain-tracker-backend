const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();

  if (!content) return [];

  const lines = content.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : '';
    });

    return row;
  });
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function importCompanies() {
  const companiesPath = path.join(__dirname, '..', 'data', 'companies.csv');
  const rows = readCsv(companiesPath);

  console.log(`Importing ${rows.length} companies...`);

  for (const row of rows) {
    const company = {
      name: row.name,
      level: row.level || 'Level 1',
      country: row.country,
      city: row.city || '',
      foundedYear: row.foundedYear ? toNumber(row.foundedYear, null) : null,
      annualRevenue: toNumber(row.annualRevenue, 0),
      employees: toNumber(row.employees, 0),
    };

    const created = await postJson(`${API_BASE}/companies`, company);
    console.log(`Company imported: ${created.name}`);
  }
}

async function importRelationships() {
  const relationshipsPath = path.join(__dirname, '..', 'data', 'relationships.csv');
  const rows = readCsv(relationshipsPath);

  const companies = await getJson(`${API_BASE}/companies`);
  const companyMap = new Map();

  for (const company of companies) {
    if (company.name) {
      companyMap.set(company.name, company.id);
    }
  }

  console.log(`Importing ${rows.length} relationships...`);

  for (const row of rows) {
    const sourceCompanyId = companyMap.get(row.sourceCompanyName);
    const targetCompanyId = companyMap.get(row.targetCompanyName);

    if (!sourceCompanyId || !targetCompanyId) {
      console.log(`Skipped relationship: ${row.sourceCompanyName} -> ${row.targetCompanyName}`);
      continue;
    }

    const relationship = {
      sourceCompanyId,
      targetCompanyId,
      relationshipType: row.relationshipType || '',
      productName: row.productName || '',
      value: toNumber(row.value, 0),
      description: row.description || '',
    };

    const created = await postJson(`${API_BASE}/relationships`, relationship);
    console.log(`Relationship imported: ${created.sourceCompanyId} -> ${created.targetCompanyId}`);
  }
}

async function main() {
  try {
    await importCompanies();
    await importRelationships();
    console.log('CSV import completed.');
  } catch (error) {
    console.error('CSV import failed.');
    console.error(error.message);
    process.exit(1);
  }
}

main();
