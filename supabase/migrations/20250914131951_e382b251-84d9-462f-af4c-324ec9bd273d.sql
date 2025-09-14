-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN email TEXT;

-- Update email column from auth.users for existing profiles
UPDATE public.profiles 
SET email = auth.users.email 
FROM auth.users 
WHERE profiles.user_id = auth.users.id;

-- Drop existing team_memberships table and recreate with correct structure
DROP TABLE IF EXISTS public.team_memberships CASCADE;

-- Create team_memberships table with employee slots 1-10
CREATE TABLE public.team_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES public.profiles(id),
  employee_1_id UUID REFERENCES public.profiles(id),
  employee_2_id UUID REFERENCES public.profiles(id),
  employee_3_id UUID REFERENCES public.profiles(id),
  employee_4_id UUID REFERENCES public.profiles(id),
  employee_5_id UUID REFERENCES public.profiles(id),
  employee_6_id UUID REFERENCES public.profiles(id),
  employee_7_id UUID REFERENCES public.profiles(id),
  employee_8_id UUID REFERENCES public.profiles(id),
  employee_9_id UUID REFERENCES public.profiles(id),
  employee_10_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on team_memberships
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for team_memberships
CREATE POLICY "Managers can view their team memberships" 
ON public.team_memberships 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can create their team memberships" 
ON public.team_memberships 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can update their team memberships" 
ON public.team_memberships 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can delete their team memberships" 
ON public.team_memberships 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Create trigger for updating updated_at
CREATE TRIGGER update_team_memberships_updated_at
  BEFORE UPDATE ON public.team_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();