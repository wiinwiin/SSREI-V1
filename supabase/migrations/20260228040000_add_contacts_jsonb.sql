-- Migration to add a parsed JSONB array for Contacts & Phones to store DNC status per phone properly
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;

-- Optional: Comments for table structure indexing down the line
COMMENT ON COLUMN contacts.contacts IS 'Contains [{ "name": string, "phone": string, "email": string, "type": string, "dnc": boolean }] representations of Landlord 1/2/3 and additional contact columns imported dynamically.';
