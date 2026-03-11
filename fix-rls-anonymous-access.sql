-- SQL script to fix RLS policies for anonymous access

-- Allow anonymous users to access the 'contacts' table
ALTER POLICY "contacts_rls_policy" ON contacts
    FOR SELECT
    USING (true);

-- Allow anonymous users to access related tables
ALTER POLICY "related_table_rls_policy" ON related_table_name
    FOR SELECT
    USING (true);

-- Add additional related tables as necessary
-- Example:
-- ALTER POLICY "another_related_table_rls_policy" ON another_related_table_name
--     FOR SELECT
--     USING (true);
