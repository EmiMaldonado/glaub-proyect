-- Add new columns to profiles table for post-registration data
ALTER TABLE public.profiles 
ADD COLUMN age INTEGER,
ADD COLUMN gender TEXT CHECK (gender IN ('Male', 'Female', 'Non-binary', 'Prefer not to say')),
ADD COLUMN job_position TEXT,
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on onboarding status
CREATE INDEX idx_profiles_onboarding_completed ON public.profiles(onboarding_completed);

-- Update the handle_new_user function to set onboarding_completed to false for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, display_name, onboarding_completed)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', FALSE);
  RETURN NEW;
END;
$$;