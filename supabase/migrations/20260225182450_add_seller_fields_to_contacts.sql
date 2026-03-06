/*
  # Add Seller-Specific Fields to Contacts

  1. New Columns
    - `asking_price` (numeric) - Seller's asking price for the property
    - `lead_source_detail` (text) - Detailed source information for the lead

  2. Changes
    - These fields integrate with GHL custom fields:
      - Seller Asking Price → contact.seller_asking_price
      - Seller Lead Source → contact.seller_lead_source
      - Seller Property Address → already mapped to property_address
      - Seller Property Year Built → already mapped to year_built
      - Seller Property Estimated Value → already mapped to avm/market_value

  3. Notes
    - Fields are nullable to support existing records
    - No default values to distinguish between "not set" and "0"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'asking_price'
  ) THEN
    ALTER TABLE contacts ADD COLUMN asking_price numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'lead_source_detail'
  ) THEN
    ALTER TABLE contacts ADD COLUMN lead_source_detail text;
  END IF;
END $$;