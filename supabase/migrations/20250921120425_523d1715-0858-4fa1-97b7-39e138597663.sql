-- Add job_level field to profiles table for job experience level
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS job_level text;