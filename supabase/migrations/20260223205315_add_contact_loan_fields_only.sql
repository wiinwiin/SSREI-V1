/*
  # Add Contact Loan Detail Fields

  Adds additional financial/loan fields to the contacts table
  that were missing: lender_name, recording_date, maturity_date, hoa.
  All are optional and safe to add with IF NOT EXISTS checks.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lender_name') THEN
    ALTER TABLE contacts ADD COLUMN lender_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'recording_date') THEN
    ALTER TABLE contacts ADD COLUMN recording_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'maturity_date') THEN
    ALTER TABLE contacts ADD COLUMN maturity_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'hoa') THEN
    ALTER TABLE contacts ADD COLUMN hoa boolean DEFAULT false;
  END IF;
END $$;
