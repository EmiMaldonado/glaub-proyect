-- Fix missing profiles and email sync issues

-- Update the handle_new_user function to include email field
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    display_name, 
    email,
    onboarding_completed
  )
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'display_name',
    NEW.email,
    FALSE
  );
  RETURN NEW;
END;
$$;

-- Update existing profiles to sync email from auth.users
UPDATE profiles 
SET email = auth_users.email
FROM (
  SELECT id, email FROM auth.users
) AS auth_users
WHERE profiles.user_id = auth_users.id 
AND profiles.email IS NULL;

-- Create profiles for any auth users that don't have profiles yet
INSERT INTO profiles (user_id, full_name, display_name, email, onboarding_completed)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.email,
  false
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL;