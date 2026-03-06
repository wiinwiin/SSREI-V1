/*
  # Create Bulk Upsert Contacts Function
  
  1. New Functions
    - `bulk_upsert_contacts` - High-performance bulk insert for contact imports
      - Accepts JSON array of contacts
      - Uses INSERT with ON CONFLICT for deduplication
      - Returns array of inserted contact IDs
  
  2. Performance
    - Handles 2000+ contacts per call
    - Single database round-trip
    - Automatic duplicate handling via property_address + property_city matching
*/

CREATE OR REPLACE FUNCTION bulk_upsert_contacts(contacts_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_ids jsonb := '[]'::jsonb;
BEGIN
  WITH inserted AS (
    INSERT INTO contacts (
      first_name, last_name, property_name, lead_type,
      property_address, property_city, property_state, property_zip,
      mailing_address, mailing_city, mailing_state, mailing_zip,
      contact1_name, contact1_type, contact1_phone1, contact1_phone2, contact1_phone3,
      contact1_phone1_type, contact1_phone2_type, contact1_phone3_type,
      contact1_email1, contact1_email2, contact1_email3,
      contact2_name, contact2_type, contact2_phone1, contact2_phone2, contact2_phone3,
      contact2_phone1_type, contact2_phone2_type, contact2_phone3_type,
      contact2_email1, contact2_email2, contact2_email3,
      contact3_name, contact3_type, contact3_phone1, contact3_phone2, contact3_phone3,
      contact3_phone1_type, contact3_phone2_type, contact3_phone3_type,
      contact3_email1, contact3_email2, contact3_email3,
      batch_id, batch_name, dnc_toggle, litigator, overall_status,
      distress_score, score_tier, distress_flags, deal_automator_url,
      source, created_by, pushed_to_ghl, tags,
      beds, baths, sqft, year_built, lot_size, avm, market_value,
      wholesale_value, rental_estimate_low, rental_estimate_high,
      loan_amount, loan_type, estimated_mortgage_balance, estimated_mortgage_payment,
      tax_amount, owner_type, absentee_owner, foreclosure_activity,
      delinquent_tax, high_equity, free_and_clear, upside_down,
      long_term_owner, potentially_inherited, active_listing,
      retail_sellability_score, rental_sellability_score, wholesale_sellability_score,
      address_hash
    )
    SELECT
      (c->>'first_name')::text,
      (c->>'last_name')::text,
      (c->>'property_name')::text,
      (c->>'lead_type')::text,
      (c->>'property_address')::text,
      (c->>'property_city')::text,
      (c->>'property_state')::text,
      (c->>'property_zip')::text,
      (c->>'mailing_address')::text,
      (c->>'mailing_city')::text,
      (c->>'mailing_state')::text,
      (c->>'mailing_zip')::text,
      (c->>'contact1_name')::text,
      (c->>'contact1_type')::text,
      (c->>'contact1_phone1')::text,
      (c->>'contact1_phone2')::text,
      (c->>'contact1_phone3')::text,
      (c->>'contact1_phone1_type')::text,
      (c->>'contact1_phone2_type')::text,
      (c->>'contact1_phone3_type')::text,
      (c->>'contact1_email1')::text,
      (c->>'contact1_email2')::text,
      (c->>'contact1_email3')::text,
      (c->>'contact2_name')::text,
      (c->>'contact2_type')::text,
      (c->>'contact2_phone1')::text,
      (c->>'contact2_phone2')::text,
      (c->>'contact2_phone3')::text,
      (c->>'contact2_phone1_type')::text,
      (c->>'contact2_phone2_type')::text,
      (c->>'contact2_phone3_type')::text,
      (c->>'contact2_email1')::text,
      (c->>'contact2_email2')::text,
      (c->>'contact2_email3')::text,
      (c->>'contact3_name')::text,
      (c->>'contact3_type')::text,
      (c->>'contact3_phone1')::text,
      (c->>'contact3_phone2')::text,
      (c->>'contact3_phone3')::text,
      (c->>'contact3_phone1_type')::text,
      (c->>'contact3_phone2_type')::text,
      (c->>'contact3_phone3_type')::text,
      (c->>'contact3_email1')::text,
      (c->>'contact3_email2')::text,
      (c->>'contact3_email3')::text,
      (c->>'batch_id')::uuid,
      (c->>'batch_name')::text,
      (c->>'dnc_toggle')::boolean,
      (c->>'litigator')::boolean,
      (c->>'overall_status')::text,
      (c->>'distress_score')::integer,
      (c->>'score_tier')::text,
      (c->>'distress_flags')::text,
      (c->>'deal_automator_url')::text,
      (c->>'source')::text,
      (c->>'created_by')::text,
      (c->>'pushed_to_ghl')::boolean,
      COALESCE((c->>'tags')::jsonb, '[]'::jsonb),
      (c->>'beds')::integer,
      (c->>'baths')::numeric,
      (c->>'sqft')::integer,
      (c->>'year_built')::integer,
      (c->>'lot_size')::integer,
      (c->>'avm')::numeric,
      (c->>'market_value')::numeric,
      (c->>'wholesale_value')::numeric,
      (c->>'rental_estimate_low')::numeric,
      (c->>'rental_estimate_high')::numeric,
      (c->>'loan_amount')::numeric,
      (c->>'loan_type')::text,
      (c->>'estimated_mortgage_balance')::numeric,
      (c->>'estimated_mortgage_payment')::numeric,
      (c->>'tax_amount')::numeric,
      (c->>'owner_type')::text,
      (c->>'absentee_owner')::boolean,
      (c->>'foreclosure_activity')::boolean,
      (c->>'delinquent_tax')::boolean,
      (c->>'high_equity')::boolean,
      (c->>'free_and_clear')::boolean,
      (c->>'upside_down')::boolean,
      (c->>'long_term_owner')::boolean,
      (c->>'potentially_inherited')::boolean,
      (c->>'active_listing')::boolean,
      (c->>'retail_sellability_score')::integer,
      (c->>'rental_sellability_score')::integer,
      (c->>'wholesale_sellability_score')::integer,
      (c->>'address_hash')::text
    FROM jsonb_array_elements(contacts_data) AS c
    ON CONFLICT (property_address, property_city) 
    WHERE property_address IS NOT NULL AND property_city IS NOT NULL
    DO NOTHING
    RETURNING id
  )
  SELECT jsonb_agg(id) INTO inserted_ids FROM inserted;
  
  RETURN COALESCE(inserted_ids, '[]'::jsonb);
END;
$$;