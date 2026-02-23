import type { CSVRow } from '../types';

export function parseCSV(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: CSVRow = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function mapCSVRowToContact(row: CSVRow) {
  const parseBool = (v?: string) => {
    if (!v) return undefined;
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' ? true : (s === 'false' || s === '0' || s === 'no' ? false : undefined);
  };
  const parseNum = (v?: string) => {
    if (!v) return undefined;
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? undefined : n;
  };
  const parseDate = (v?: string) => {
    if (!v || !v.trim()) return undefined;
    return v.trim();
  };

  return {
    first_name: row['FirstName'] || undefined,
    last_name: row['LastName'] || undefined,
    mailing_address: row['RecipientAddress'] || undefined,
    mailing_city: row['RecipientCity'] || undefined,
    mailing_state: row['RecipientState'] || undefined,
    mailing_zip: row['RecipientPostalCode'] || undefined,
    property_address: row['PropertyAddress'] || undefined,
    property_city: row['PropertyCity'] || undefined,
    property_state: row['PropertyState'] || undefined,
    property_zip: row['PropertyPostalCode'] || undefined,
    county: row['County'] || undefined,
    property_type: row['PropertyType'] || undefined,
    units: row['Units'] || undefined,
    beds: row['Beds'] || undefined,
    baths: row['Baths'] || undefined,
    sqft: parseNum(row['SquareFootage']),
    lot_size: parseNum(row['LotSizeSqFt']),
    year_built: parseNum(row['YearBuilt']),
    house_style: row['HouseStyle'] || undefined,
    stories: row['Stories'] || undefined,
    condition: row['Condition'] || undefined,
    exterior: row['Exterior'] || undefined,
    roof: row['Roof'] || undefined,
    basement: row['Basement'] || undefined,
    garage: row['Garage'] || undefined,
    heating: row['Heating'] || undefined,
    air_conditioning: row['AirConditioning'] || undefined,
    pool: parseBool(row['Pool']),
    patio: parseBool(row['Patio']),
    porch: parseBool(row['Porch']),
    fireplace: parseBool(row['Fireplace']),
    water: row['Water'] || undefined,
    sewer: row['Sewer'] || undefined,
    zoning: row['Zoning'] || undefined,
    subdivision: row['Subdivision'] || undefined,
    address_hash: row['AddressHash'] || row['Id'] || undefined,

    contact1_name: row['Contact1Name'] || undefined,
    contact1_type: row['Contact1Type'] || undefined,
    contact1_phone1: row['Contact1Phone_1'] || undefined,
    contact1_phone1_type: row['Contact1Phone_1_Type'] || undefined,
    contact1_phone2: row['Contact1Phone_2'] || undefined,
    contact1_phone2_type: row['Contact1Phone_2_Type'] || undefined,
    contact1_phone3: row['Contact1Phone_3'] || undefined,
    contact1_phone3_type: row['Contact1Phone_3_Type'] || undefined,
    contact1_email1: row['Contact1Email_1'] || undefined,
    contact1_email2: row['Contact1Email_2'] || undefined,
    contact1_email3: row['Contact1Email_3'] || undefined,

    contact2_name: row['Contact2Name'] || undefined,
    contact2_type: row['Contact2Type'] || undefined,
    contact2_phone1: row['Contact2Phone_1'] || undefined,
    contact2_phone1_type: row['Contact2Phone_1_Type'] || undefined,
    contact2_phone2: row['Contact2Phone_2'] || undefined,
    contact2_phone2_type: row['Contact2Phone_2_Type'] || undefined,
    contact2_phone3: row['Contact2Phone_3'] || undefined,
    contact2_phone3_type: row['Contact2Phone_3_Type'] || undefined,
    contact2_email1: row['Contact2Email_1'] || undefined,
    contact2_email2: row['Contact2Email_2'] || undefined,
    contact2_email3: row['Contact2Email_3'] || undefined,

    contact3_name: row['Contact3Name'] || undefined,
    contact3_type: row['Contact3Type'] || undefined,
    contact3_phone1: row['Contact3Phone_1'] || undefined,
    contact3_phone1_type: row['Contact3Phone_1_Type'] || undefined,
    contact3_phone2: row['Contact3Phone_2'] || undefined,
    contact3_phone2_type: row['Contact3Phone_2_Type'] || undefined,
    contact3_phone3: row['Contact3Phone_3'] || undefined,
    contact3_phone3_type: row['Contact3Phone_3_Type'] || undefined,
    contact3_email1: row['Contact3Email_1'] || undefined,
    contact3_email2: row['Contact3Email_2'] || undefined,
    contact3_email3: row['Contact3Email_3'] || undefined,

    absentee_owner: parseBool(row['AbsenteeOwner']),
    foreclosure_activity: parseBool(row['ForeclosureActivity']),
    delinquent_tax: parseBool(row['DelinquentTaxActivity']),
    high_equity: parseBool(row['HighEquity']),
    free_and_clear: parseBool(row['FreeAndClear']),
    upside_down: parseBool(row['UpsideDown']),
    long_term_owner: parseBool(row['LongTermOwner']),
    potentially_inherited: parseBool(row['PotentiallyInherited']),
    active_listing: parseBool(row['ActiveListing']),

    avm: parseNum(row['AVM']),
    wholesale_value: parseNum(row['WholesaleValue']),
    market_value: parseNum(row['MarketValue']),
    ltv: parseNum(row['LTV']),
    estimated_mortgage_balance: parseNum(row['EstimatedMortgageBalance']),
    estimated_mortgage_payment: parseNum(row['EstimatedMortgagePayment']),
    mortgage_interest_rate: parseNum(row['MortgageInterestRate']),
    loan_type: row['LoanType'] || undefined,
    loan_amount: parseNum(row['LoanAmount']),
    number_of_loans: parseNum(row['NumberOfLoans']),
    total_loans: parseNum(row['TotalLoans']),
    tax_amount: parseNum(row['TaxAmount']),
    hoa_fee: parseNum(row['HOAFee']),
    hoa_name: row['HOAName'] || undefined,
    hoa_fee_frequency: row['HOAFeeFrequency'] || undefined,
    rental_estimate_low: parseNum(row['RentalEstimateLow']),
    rental_estimate_high: parseNum(row['RentalEstimateHigh']),

    mls_curr_listing_id: row['MLS_Curr_ListingID'] || undefined,
    mls_curr_status: row['MLS_Curr_Status'] || undefined,
    mls_curr_list_price: parseNum(row['MLS_Curr_ListPrice']),
    mls_curr_sale_price: parseNum(row['MLS_Curr_SalePrice']),
    mls_curr_days_on_market: parseNum(row['MLS_Curr_DaysOnMarket']),
    mls_curr_list_date: parseDate(row['MLS_Curr_ListDate']),
    mls_curr_sold_date: parseDate(row['MLS_Curr_SoldDate']),
    mls_curr_description: row['MLS_Curr_Description'] || undefined,
    mls_curr_source: row['MLS_Curr_Source'] || undefined,
    mls_curr_agent_name: row['MLS_Curr_ListAgentName'] || undefined,
    mls_curr_office: row['MLS_Curr_ListAgentOffice'] || undefined,

    mls_prev_listing_id: row['MLS_Prev_ListingID'] || undefined,
    mls_prev_status: row['MLS_Prev_Status'] || undefined,
    mls_prev_list_price: parseNum(row['MLS_Prev_ListPrice']),
    mls_prev_sale_price: parseNum(row['MLS_Prev_SalePrice']),
    mls_prev_days_on_market: parseNum(row['MLS_Prev_DaysOnMarket']),
    mls_prev_list_date: parseDate(row['MLS_Prev_ListDate']),
    mls_prev_sold_date: parseDate(row['MLS_Prev_SoldDate']),
    mls_prev_description: row['MLS_Prev_Description'] || undefined,
    mls_prev_source: row['MLS_Prev_Source'] || undefined,
    mls_prev_agent_name: row['MLS_Prev_ListAgentName'] || undefined,
    mls_prev_office: row['MLS_Prev_ListAgentOffice'] || undefined,
  };
}
