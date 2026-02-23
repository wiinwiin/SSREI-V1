/*
  # Set all users to Admin role

  ## Changes
  - Updates all existing user_profiles to role = 'admin'
  - Changes the default role for new signups to 'admin'
  - This means all 4 team members (Sherwin, Fae, Kristi, Liely) are admins
*/

UPDATE public.user_profiles SET role = 'admin';

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
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
