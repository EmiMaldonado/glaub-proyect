-- Fix functions to use new hierarchical structure instead of old team_memberships

CREATE OR REPLACE FUNCTION public.manager_has_team_members(manager_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_employee_relationships 
    WHERE manager_id = manager_profile_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_manager_id(user_profile_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT mer.manager_id
  FROM manager_employee_relationships mer
  WHERE mer.employee_id = user_profile_id
  LIMIT 1;
$$;

-- Update the old check_manager_demotion function to use new structure
CREATE OR REPLACE FUNCTION public.check_manager_demotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  manager_record RECORD;
BEGIN
  -- Get the manager profile
  SELECT * INTO manager_record 
  FROM public.profiles 
  WHERE id = OLD.manager_id;
  
  -- Check if manager still has team members using new structure
  IF NOT public.validate_manager_has_employees(OLD.manager_id) THEN
    -- Demote manager and clear team name
    UPDATE public.profiles 
    SET role = 'employee', team_name = NULL, can_manage_teams = false
    WHERE id = OLD.manager_id;
  END IF;
  
  RETURN OLD;
END;
$$;