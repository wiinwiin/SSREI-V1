export interface CSVColumn {
  header: string;
  index: number;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'phone' | 'email';
  sampleValue: string;
  isEmpty: boolean;
  ghlTarget?: string;
}

export interface CSVAnalysis {
  headers: string[];
  columns: CSVColumn[];
  leadType: 'commercial' | 'acquisition';
  rowCount: number;
  hasScores: boolean;
  phoneColumns: CSVColumn[];
  emailColumns: CSVColumn[];
  ghlMappings: Record<string, string>;
}

export interface PhoneExtraction {
  number: string;
  dnc: boolean;
  litigator: boolean;
  type: string;
  source: string;
}

export function analyzeCSV(headers: string[], sampleRows: any[]): CSVAnalysis {
  const columns: CSVColumn[] = headers.map((header, index) => {
    const samples = sampleRows.map(row => row[index]).filter(v => v != null && v !== '');
    const sampleValue = samples[0] || '';
    const isEmpty = samples.length === 0;

    let dataType: CSVColumn['dataType'] = 'string';
    if (header.toLowerCase().includes('phone')) {
      dataType = 'phone';
    } else if (header.toLowerCase().includes('email')) {
      dataType = 'email';
    } else if (header.toLowerCase().includes('date')) {
      dataType = 'date';
    } else if (!isEmpty && samples.every(v => !isNaN(parseFloat(String(v).replace(/[$,]/g, ''))))) {
      dataType = 'number';
    } else if (samples.some(v => String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'false')) {
      dataType = 'boolean';
    }

    return {
      header,
      index,
      dataType,
      sampleValue,
      isEmpty,
    };
  });

  const lastNameIndex = headers.findIndex(h => h.toLowerCase() === 'lastname');
  const lastNameSamples = sampleRows.map(row => row[lastNameIndex]).filter(v => v != null && v !== '');
  const isCommercial = lastNameIndex >= 0 && lastNameSamples.length === 0;

  const hasScores = headers.some(h =>
    h.toLowerCase().includes('retailscore') ||
    h.toLowerCase().includes('rentalscore') ||
    h.toLowerCase().includes('wholesalescore')
  );

  const phoneColumns = columns.filter(c =>
    c.dataType === 'phone' ||
    c.header.toLowerCase().includes('phone') ||
    c.header.toLowerCase().includes('contact')
  );

  const emailColumns = columns.filter(c =>
    c.dataType === 'email' ||
    c.header.toLowerCase().includes('email')
  );

  const ghlMappings = buildGHLMappings(headers);

  return {
    headers,
    columns,
    leadType: isCommercial ? 'commercial' : 'acquisition',
    rowCount: sampleRows.length,
    hasScores,
    phoneColumns,
    emailColumns,
    ghlMappings,
  };
}

function buildGHLMappings(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};

  const fieldMap: Record<string, string[]> = {
    'seller_property_address': ['propertyaddress', 'property_address', 'address1', 'full_address'],
    'seller_property_year_built': ['yearbuilt', 'year_built'],
    'seller_asking_price': ['askingprice', 'asking_price', 'list_price'],
    'seller_property_estimated_value': ['avm', 'market_value', 'marketvalue'],
    'seller_lead_source': ['lead_source', 'source'],
    'retail_score': ['retailscore'],
    'rental_score': ['rentalscore'],
    'wholesale_score': ['wholesalescore'],
  };

  for (const [ghlField, csvVariants] of Object.entries(fieldMap)) {
    for (const variant of csvVariants) {
      const foundHeader = headers.find(h =>
        h.toLowerCase().replace(/[_\s]/g, '') === variant.toLowerCase().replace(/[_\s]/g, '')
      );
      if (foundHeader) {
        mappings[foundHeader] = ghlField;
        break;
      }
    }
  }

  return mappings;
}

export function extractPhonesFromRow(row: any, headers: string[], analysis: CSVAnalysis): PhoneExtraction[] {
  const phones: PhoneExtraction[] = [];

  const phonePatterns = [
    { pattern: /Contact(\d+)Phone_(\d+)$/i, namePattern: /Contact(\d+)Name$/i },
    { pattern: /Contact(\d+)Phone(\d+)$/i, namePattern: /Contact(\d+)Name$/i },
  ];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const value = row[i];

    if (!value || value === '') continue;

    if (header.toLowerCase().includes('phone')) {
      const phoneNumber = String(value).replace(/\D/g, '');
      if (phoneNumber.length >= 10) {
        const dncHeader = headers.find(h =>
          h.toLowerCase().includes('dnc') &&
          h.toLowerCase().includes(header.toLowerCase().split('phone')[0])
        );
        const litigatorHeader = headers.find(h =>
          h.toLowerCase().includes('litigator') &&
          h.toLowerCase().includes(header.toLowerCase().split('phone')[0])
        );
        const typeHeader = headers.find(h =>
          h === header + '_Type' || h === header + 'Type'
        );

        const dncIndex = dncHeader ? headers.indexOf(dncHeader) : -1;
        const litigatorIndex = litigatorHeader ? headers.indexOf(litigatorHeader) : -1;
        const typeIndex = typeHeader ? headers.indexOf(typeHeader) : -1;

        phones.push({
          number: phoneNumber,
          dnc: dncIndex >= 0 ? String(row[dncIndex]).toLowerCase() === 'true' : false,
          litigator: litigatorIndex >= 0 ? String(row[litigatorIndex]).toLowerCase() === 'true' : false,
          type: typeIndex >= 0 ? String(row[typeIndex]) : extractContactType(header),
          source: `${header} (col ${i})`,
        });
      }
    }
  }

  return phones.filter((phone, index, self) =>
    index === self.findIndex(p => p.number === phone.number)
  );
}

function extractContactType(header: string): string {
  if (header.toLowerCase().includes('contact1')) return 'Contact 1';
  if (header.toLowerCase().includes('contact2')) return 'Contact 2';
  if (header.toLowerCase().includes('contact3')) return 'Contact 3';
  if (header.toLowerCase().includes('landlord')) return 'Landlord';
  if (header.toLowerCase().includes('tenant')) return 'Tenant';
  if (header.toLowerCase().includes('mobile')) return 'Mobile';
  if (header.toLowerCase().includes('residential')) return 'Residential';
  if (header.toLowerCase().includes('commercial')) return 'Commercial';
  return 'Unknown';
}

export function mapRowToContact(row: any, headers: string[], analysis: CSVAnalysis): Partial<any> {
  const contact: any = {};

  const firstNameIdx = headers.findIndex(h => h.toLowerCase() === 'firstname');
  const lastNameIdx = headers.findIndex(h => h.toLowerCase() === 'lastname');

  if (analysis.leadType === 'commercial') {
    contact.property_name = row[firstNameIdx] || '';
    contact.lead_type = 'commercial';
  } else {
    contact.first_name = row[firstNameIdx] || '';
    contact.last_name = row[lastNameIdx] || '';
    contact.lead_type = 'acquisition';
  }

  const fieldMappings: Record<string, string> = {
    'PropertyAddress': 'property_address',
    'PropertyCity': 'property_city',
    'PropertyState': 'property_state',
    'PropertyPostalCode': 'property_zip',
    'RecipientAddress': 'mailing_address',
    'RecipientCity': 'mailing_city',
    'RecipientState': 'mailing_state',
    'RecipientPostalCode': 'mailing_zip',
    'County': 'county',
    'PropertyType': 'property_type',
    'Units': 'units',
    'Beds': 'beds',
    'Baths': 'baths',
    'SquareFootage': 'sqft',
    'LotSizeSqFt': 'lot_size',
    'YearBuilt': 'year_built',
    'HouseStyle': 'house_style',
    'Stories': 'stories',
    'Condition': 'condition',
    'Exterior': 'exterior',
    'Roof': 'roof',
    'Basement': 'basement',
    'Garage': 'garage',
    'Zoning': 'zoning',
    'Subdivision': 'subdivision',
    'AVM': 'avm',
    'MarketValue': 'market_value',
    'WholesaleValue': 'wholesale_value',
    'AssessedTotal': 'assessed_value',
    'LTV': 'ltv',
    'LoanAmount': 'loan_amount',
    'EstimatedMortgageBalance': 'estimated_mortgage_balance',
    'EstimatedMortgagePayment': 'estimated_mortgage_payment',
    'MortgageInterestRate': 'mortgage_interest_rate',
    'LoanType': 'loan_type',
    'NumberOfLoans': 'number_of_loans',
    'TaxAmount': 'tax_amount',
    'RentalEstimateLow': 'rental_estimate_low',
    'RentalEstimateHigh': 'rental_estimate_high',
    'LastSalesDate': 'last_sale_date',
    'LastSalesPrice': 'last_sale_price',
    'AbsenteeOwner': 'absentee_owner',
    'ForeclosureActivity': 'foreclosure_activity',
    'DelinquentTaxActivity': 'delinquent_tax',
    'HighEquity': 'high_equity',
    'FreeAndClear': 'free_and_clear',
    'UpsideDown': 'upside_down',
    'LongTermOwner': 'long_term_owner',
    'PotentiallyInherited': 'potentially_inherited',
    'ActiveListing': 'active_listing',
    'RetailScore': 'retail_score',
    'RentalScore': 'rental_score',
    'WholesaleScore': 'wholesale_score',
  };

  for (const [csvHeader, dbField] of Object.entries(fieldMappings)) {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/[_\s]/g, '') === csvHeader.toLowerCase().replace(/[_\s]/g, ''));
    if (idx >= 0 && row[idx] != null && row[idx] !== '') {
      let value = row[idx];

      if (typeof value === 'string') {
        value = value.replace(/[$,]/g, '');
      }

      if (dbField.includes('_owner') || dbField.includes('_activity') || dbField.includes('_tax') ||
          dbField.includes('_equity') || dbField.includes('_clear') || dbField.includes('_listing') ||
          dbField.includes('_inherited') || dbField === 'upside_down') {
        contact[dbField] = value === '1' || String(value).toLowerCase() === 'true';
      } else if (!isNaN(parseFloat(value)) && (dbField.includes('_amount') || dbField.includes('_price') ||
                 dbField.includes('sqft') || dbField.includes('lot_size') || dbField === 'avm' ||
                 dbField.includes('value') || dbField.includes('ltv') || dbField.includes('score'))) {
        contact[dbField] = parseFloat(value);
      } else {
        contact[dbField] = value;
      }
    }
  }

  const phones = extractPhonesFromRow(row, headers, analysis);
  if (phones.length > 0) {
    contact.phones = phones;
    contact.contact1_phone1 = phones[0]?.number;
    contact.contact1_phone1_type = phones[0]?.type;
    if (phones[1]) {
      contact.contact1_phone2 = phones[1]?.number;
      contact.contact1_phone2_type = phones[1]?.type;
    }
    if (phones[2]) {
      contact.contact1_phone3 = phones[2]?.number;
      contact.contact1_phone3_type = phones[2]?.type;
    }
  }

  for (let contactNum = 1; contactNum <= 3; contactNum++) {
    const nameIdx = headers.findIndex(h => h === `Contact${contactNum}Name`);
    const typeIdx = headers.findIndex(h => h === `Contact${contactNum}Type`);
    const email1Idx = headers.findIndex(h => h === `Contact${contactNum}Email_1`);
    const email2Idx = headers.findIndex(h => h === `Contact${contactNum}Email_2`);
    const email3Idx = headers.findIndex(h => h === `Contact${contactNum}Email_3`);

    if (nameIdx >= 0 && row[nameIdx]) contact[`contact${contactNum}_name`] = row[nameIdx];
    if (typeIdx >= 0 && row[typeIdx]) contact[`contact${contactNum}_type`] = row[typeIdx];
    if (email1Idx >= 0 && row[email1Idx]) contact[`contact${contactNum}_email1`] = row[email1Idx];
    if (email2Idx >= 0 && row[email2Idx]) contact[`contact${contactNum}_email2`] = row[email2Idx];
    if (email3Idx >= 0 && row[email3Idx]) contact[`contact${contactNum}_email3`] = row[email3Idx];
  }

  return contact;
}

export function generateImportSummary(analysis: CSVAnalysis, rows: any[]): string {
  const commercial = rows.filter((_, i) => i < analysis.rowCount).length;
  const commercialPct = analysis.leadType === 'commercial' ? 100 : 0;

  const missingFields = Object.values(analysis.ghlMappings).length === 0
    ? ['No GHL custom fields detected in CSV']
    : [];

  return `
**CSV Analysis Complete**

- Total Rows: ${rows.length}
- Lead Type: ${analysis.leadType === 'commercial' ? 'Commercial' : 'Acquisitions'}
- Has Scores: ${analysis.hasScores ? 'Yes (Retail/Rental/Wholesale)' : 'No'}
- Phone Columns: ${analysis.phoneColumns.length}
- Email Columns: ${analysis.emailColumns.length}
- GHL Mappings: ${Object.keys(analysis.ghlMappings).length}

${missingFields.length > 0 ? `\n**Missing GHL Fields:**\n${missingFields.join('\n')}` : ''}
  `.trim();
}
