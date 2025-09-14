-- Add team_name field to profiles table
ALTER TABLE public.profiles ADD COLUMN team_name TEXT;

-- Create team_memberships junction table for multi-team support
CREATE TABLE public.team_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, manager_id)
);

-- Enable RLS on team_memberships
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

-- Create policies for team_memberships table
CREATE POLICY "Users can view their team memberships" 
ON public.team_memberships 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.employee_id 
    AND profiles.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Managers can create team memberships" 
ON public.team_memberships 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.manager_id 
    AND profiles.user_id = auth.uid()
    AND profiles.role = 'manager'
  )
);

CREATE POLICY "Users can delete their own team memberships" 
ON public.team_memberships 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.employee_id 
    AND profiles.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = team_memberships.manager_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Create function to check if a manager has team members
CREATE OR REPLACE FUNCTION public.manager_has_team_members(manager_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_memberships 
    WHERE manager_id = manager_profile_id
  )
$$;

-- Create function to auto-demote managers who lose all team members
CREATE OR REPLACE FUNCTION public.check_manager_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  manager_record RECORD;
BEGIN
  -- Get the manager profile
  SELECT * INTO manager_record 
  FROM public.profiles 
  WHERE id = OLD.manager_id;
  
  -- Check if manager still has team members
  IF NOT public.manager_has_team_members(OLD.manager_id) THEN
    -- Demote manager and clear team name
    UPDATE public.profiles 
    SET role = 'employee', team_name = NULL
    WHERE id = OLD.manager_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger for auto-demotion
CREATE TRIGGER trigger_check_manager_demotion
  AFTER DELETE ON public.team_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_manager_demotion();

-- Create function to set initial team name when user becomes manager
CREATE OR REPLACE FUNCTION public.set_initial_team_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If role changed to manager and team_name is null, set default team name
  IF NEW.role = 'manager' AND OLD.role != 'manager' AND NEW.team_name IS NULL THEN
    NEW.team_name = COALESCE(NEW.display_name, NEW.full_name, 'Team') || '''s Team';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for setting initial team name
CREATE TRIGGER trigger_set_initial_team_name
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_initial_team_name();