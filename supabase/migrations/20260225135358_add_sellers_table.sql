/*
  # Add Sellers Table

  1. New Tables
    - `sellers`
      - `id` (uuid, primary key)
      - `name` (text) - Seller's full name
      - `email` (text) - Contact email
      - `phone` (text) - Contact phone
      - `company` (text) - Company name
      - `property_types` (text[]) - Types of properties they're interested in
      - `target_areas` (text[]) - Geographic areas of interest
      - `min_budget` (numeric) - Minimum budget
      - `max_budget` (numeric) - Maximum budget
      - `notes` (text) - Additional notes
      - `status` (text) - Status: active, inactive, pending
      - `is_active` (boolean) - Quick filter for active sellers
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - User who created the record

  2. Security
    - Enable RLS on `sellers` table
    - Add policies for authenticated users to manage sellers
*/

CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  property_types text[] DEFAULT '{}',
  target_areas text[] DEFAULT '{}',
  min_budget numeric DEFAULT 0,
  max_budget numeric DEFAULT 0,
  notes text DEFAULT '',
  status text DEFAULT 'active',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sellers"
  ON sellers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sellers"
  ON sellers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sellers"
  ON sellers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sellers"
  ON sellers
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_is_active ON sellers(is_active);
CREATE INDEX IF NOT EXISTS idx_sellers_created_at ON sellers(created_at DESC);