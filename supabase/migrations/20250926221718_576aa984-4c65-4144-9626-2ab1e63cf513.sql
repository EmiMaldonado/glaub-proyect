-- Fix security warnings: Enable RLS on backup tables and fix function search paths

-- CRITICAL: Enable RLS on backup tables that were missed
ALTER TABLE public.profiles_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships_backup ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies for backup tables (admin only access)
CREATE POLICY "Service role only access to profiles_backup"
ON public.profiles_backup
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role only access to team_memberships_backup" 
ON public.team_memberships_backup
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix function search paths for security
CREATE OR REPLACE FUNCTION public.get_direct_reports(manager_profile_id UUID)
RETURNS TABLE(employee_id UUID, employee_name TEXT, employee_email TEXT)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    mer.employee_id,
    p.full_name as employee_name,
    p.email as employee_email
  FROM manager_employee_relationships mer
  JOIN profiles p ON p.id = mer.employee_id
  WHERE mer.manager_id = manager_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_chain(employee_profile_id UUID)
RETURNS TABLE(manager_id UUID, manager_name TEXT, level INTEGER)
LANGUAGE SQL
STABLE SECURITY DEFINER  
SET search_path = 'public'
AS $$
  WITH RECURSIVE manager_hierarchy AS (
    -- Base case: direct manager
    SELECT 
      mer.manager_id,
      p.full_name as manager_name,
      1 as level
    FROM manager_employee_relationships mer
    JOIN profiles p ON p.id = mer.manager_id
    WHERE mer.employee_id = employee_profile_id
    
    UNION ALL
    
    -- Recursive case: manager's manager
    SELECT 
      mer.manager_id,
      p.full_name as manager_name,
      mh.level + 1
    FROM manager_employee_relationships mer
    JOIN profiles p ON p.id = mer.manager_id
    JOIN manager_hierarchy mh ON mh.manager_id = mer.employee_id
    WHERE mh.level < 10 -- Prevent infinite loops
  )
  SELECT * FROM manager_hierarchy ORDER BY level;
$$;

CREATE OR REPLACE FUNCTION public.validate_manager_has_employees(manager_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM manager_employee_relationships 
    WHERE manager_id = manager_profile_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_manager_capabilities(profile_id UUID)
RETURNS TABLE(
  is_manager BOOLEAN,
  has_employees BOOLEAN,
  can_access_dashboard BOOLEAN,
  employee_count INTEGER
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    (p.can_manage_teams = true OR EXISTS(
      SELECT 1 FROM manager_employee_relationships mer WHERE mer.manager_id = profile_id
    )) as is_manager,
    public.validate_manager_has_employees(profile_id) as has_employees,
    (public.validate_manager_has_employees(profile_id) AND (
      p.can_manage_teams = true OR EXISTS(
        SELECT 1 FROM manager_employee_relationships mer WHERE mer.manager_id = profile_id
      )
    )) as can_access_dashboard,
    COALESCE((
      SELECT COUNT(*) 
      FROM manager_employee_relationships mer 
      WHERE mer.manager_id = profile_id
    ), 0)::INTEGER as employee_count
  FROM profiles p
  WHERE p.id = profile_id;
$$;

CREATE OR REPLACE FUNCTION public.handle_manager_demotion()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  manager_still_has_employees BOOLEAN;
BEGIN
  -- Check if the manager still has employees after this change
  SELECT public.validate_manager_has_employees(COALESCE(OLD.manager_id, NEW.manager_id)) 
  INTO manager_still_has_employees;
  
  -- If manager has no employees left, demote them
  IF NOT manager_still_has_employees THEN
    UPDATE public.profiles 
    SET 
      can_manage_teams = false,
      role = 'employee',
      team_name = NULL
    WHERE id = COALESCE(OLD.manager_id, NEW.manager_id);
    
    -- Create notification
    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT 
      p.user_id,
      'role_change',
      'Manager Role Removed',
      'You have been automatically demoted from manager as you no longer have any employees.',
      jsonb_build_object(
        'previous_role', 'manager', 
        'new_role', 'employee',
        'reason', 'no_employees'
      )
    FROM public.profiles p
    WHERE p.id = COALESCE(OLD.manager_id, NEW.manager_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_manager_promotion()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If promoting to manager or enabling can_manage_teams
  IF (NEW.can_manage_teams = true AND OLD.can_manage_teams = false) 
     OR (NEW.role = 'manager' AND OLD.role != 'manager') THEN
    
    -- Check if they actually have employees
    IF NOT public.validate_manager_has_employees(NEW.id) THEN
      RAISE EXCEPTION 'Cannot promote to manager: user has no employees. Add employees first.';
    END IF;
    
    -- Set team name if not set
    IF NEW.team_name IS NULL THEN
      NEW.team_name = COALESCE(NEW.display_name, NEW.full_name, 'Manager') || '''s Team';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;