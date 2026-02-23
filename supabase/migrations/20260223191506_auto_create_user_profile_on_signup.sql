/*
  # Auto-create user profile on Supabase Auth signup

  ## Overview
  Creates a PostgreSQL trigger that automatically inserts a row into
  user_profiles whenever a new user is created in auth.users.

  ## New Objects
  - Function: handle_new_user() — inserts into user_profiles with role 'agent'
  - Trigger: on_auth_user_created — fires after INSERT on auth.users

  ## Notes
  - Default role is 'agent'
  - Admin role must be set manually in user_profiles table
  - display_name defaults to the email prefix (before @)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
